import rehypeShiki from '@shikijs/rehype';
import type { Element, Root } from 'hast';
import { toString as mdText } from 'mdast-util-to-string';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { faDigits } from '../i18n/format';

export interface Heading {
  id: string;
  text: string;
}
export interface Rendered {
  html: string;
  headings: Heading[];
}
/** Callout boxes: `:::tip` … `:::` (optional custom title: `:::warning[Careful]`). */
export const CALLOUTS = ['info', 'note', 'tip', 'success', 'warning', 'danger'] as const;
type Callout = (typeof CALLOUTS)[number];
const CALLOUT_TITLES: Record<'en' | 'fa', Record<Callout, string>> = {
  en: {
    info: 'Info',
    note: 'Note',
    tip: 'Tip',
    success: 'Success',
    warning: 'Warning',
    danger: 'Danger',
  },
  fa: {
    info: 'اطلاعات',
    note: 'یادداشت',
    tip: 'نکته',
    success: 'موفقیت',
    warning: 'هشدار',
    danger: 'خطر',
  },
};
const ANCHOR_LABEL = { en: 'Link to this section', fa: 'پیوند به این بخش' } as const;

export interface RenderOptions {
  /** Language of the post: default callout titles and link labels. */
  lang?: 'en' | 'fa';
  /** Maps the filename in `![](img:<filename>)` to a browser URL. */
  resolveImage: (filename: string) => string;
  /** Digits used for the `/01` heading numbers; Persian posts get Persian numerals. */
  numerals?: 'latin' | 'fa';
}

const text = (node: Element): string =>
  node.children
    .map((c) => (c.type === 'text' ? c.value : c.type === 'element' ? text(c) : ''))
    .join('');

const h = (
  tagName: string,
  properties: Element['properties'],
  children: Element['children'],
): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
});

/** Wraps fenced code in the terminal block (header with language + copy button) before Shiki runs. */
function rehypeTerm() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return undefined;
      const code = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      );
      const cls = (code?.properties?.className as string[] | undefined) ?? [];
      const lang = cls.find((c) => c.startsWith('language-'))?.slice(9) ?? 'text';
      if (lang === 'mermaid') {
        // Diagrams are rendered in the browser (scripts/mermaid.ts). The source stays as plain text so the page still
        // reads without JavaScript, and Shiki ignores it (it only touches <pre><code>).
        const src = code ? text(code) : '';
        parent.children[index] = h('div', { className: ['mermaid-block'], 'data-mermaid': '' }, [
          h('pre', { className: ['mermaid-src'] }, [{ type: 'text', value: src }]),
        ]);
        return 'skip';
      }
      parent.children[index] = h('div', { className: ['term'] }, [
        h('div', { className: ['tb'] }, [
          h('span', {}, [{ type: 'text', value: lang }]),
          h('button', { className: ['copy'], type: 'button' }, [{ type: 'text', value: 'copy' }]),
        ]),
        node,
      ]);
      return 'skip';
    });
  };
}

type MdNode = {
  type: string;
  name?: string;
  children?: MdNode[];
  value?: string;
  data?: Record<string, unknown>;
  attributes?: Record<string, string | null | undefined> | null;
};

const directiveSource = (n: MdNode, marker: string): string => {
  const label = n.children?.length ? `[${mdText(n.children as never)}]` : '';
  const attrs = Object.entries(n.attributes ?? {})
    .map(([k, v]) => (v == null || v === '' ? k : `${k}="${v}"`))
    .join(' ');
  return `${marker}${n.name ?? ''}${label}${attrs ? `{${attrs}}` : ''}`;
};

/**
 * Turns `:::kind` containers into callout boxes. Everything else remark-directive recognises (inline `a:b`,
 * `::x`, unknown `:::x`) is turned back into the plain text the author typed, so ordinary prose is never eaten.
 */
function remarkCallouts(lang: 'en' | 'fa') {
  return (tree: MdNode) => {
    visit(tree as never, (raw: unknown, index: number | undefined, rawParent: unknown) => {
      const node = raw as MdNode;
      const parent = rawParent as MdNode | undefined;
      if (!parent?.children || index === undefined) return undefined;
      if (node.type === 'textDirective') {
        parent.children[index] = { type: 'text', value: directiveSource(node, ':') };
        return undefined;
      }
      if (node.type === 'leafDirective') {
        parent.children[index] = {
          type: 'paragraph',
          children: [{ type: 'text', value: directiveSource(node, '::') }],
        };
        return undefined;
      }
      if (node.type !== 'containerDirective') return undefined;
      const kind = node.name as Callout;
      if (!CALLOUTS.includes(kind)) {
        parent.children.splice(
          index,
          1,
          { type: 'paragraph', children: [{ type: 'text', value: directiveSource(node, ':::') }] },
          ...(node.children ?? []),
        );
        return index;
      }
      const kids = node.children ?? [];
      const first = kids[0];
      const label = first?.data?.directiveLabel ? kids.shift() : undefined;
      const title = label ? mdText(label as never) : CALLOUT_TITLES[lang][kind];
      node.data = {
        hName: 'aside',
        hProperties: { className: ['callout', `callout-${kind}`], role: 'note' },
      };
      kids.unshift({
        type: 'paragraph',
        data: { hName: 'div', hProperties: { className: ['callout-title'] } },
        children: [{ type: 'text', value: title }],
      });
      node.children = kids;
      return undefined;
    });
  };
}

const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#|\.{1,2}\/|[^:]*$)/i;

/** Signal-specific structure: numbered h2, figures, safe links, terminal-style code blocks. */
function rehypeSignal(options: RenderOptions, headings: Heading[]) {
  return (tree: Root) => {
    let n = 0;
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName === 'h2' && node.properties?.id === 'footnote-label') {
        // the visually hidden footnotes heading is neither numbered nor part of the TOC
      } else if (node.tagName === 'h2') {
        n += 1;
        headings.push({ id: String(node.properties?.id ?? ''), text: text(node) });
        node.children.unshift(
          h('span', {}, [
            {
              type: 'text',
              value: `/${(options.numerals ?? (options.lang === 'fa' ? 'fa' : 'latin')) === 'fa' ? faDigits(String(n).padStart(2, '0')) : String(n).padStart(2, '0')}`,
            },
          ]),
        );
      } else if (node.tagName === 'img') {
        const src = String(node.properties?.src ?? '');
        if (src.startsWith('img:')) node.properties.src = options.resolveImage(src.slice(4));
        node.properties.loading = 'lazy';
        node.properties.decoding = 'async';
        const alt = String(node.properties?.alt ?? '');
        if (
          parent &&
          index !== undefined &&
          parent.type === 'element' &&
          parent.tagName === 'p' &&
          parent.children.length === 1
        ) {
          parent.tagName = 'figure';
          parent.properties = {};
          if (alt) parent.children.push(h('figcaption', {}, [{ type: 'text', value: alt }]));
        }
      } else if (node.tagName === 'a') {
        const href = String(node.properties?.href ?? '');
        if (!SAFE_HREF.test(href.trim())) delete node.properties.href;
        else if (/^https?:\/\//i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = ['noopener', 'noreferrer'];
        }
      }
      return undefined;
    });
  };
}

// Built once: Shiki's highlighter is expensive to create. Per-call state travels in `file.data`.
type Data = { options: RenderOptions; headings: Heading[] };
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(function callouts() {
    return (tree, file) => remarkCallouts((file.data as Data).options.lang ?? 'en')(tree as never);
  })
  .use(remarkRehype) // raw HTML in the source is dropped, never passed through
  .use(rehypeSlug)
  .use(rehypeTerm)
  .use(rehypeShiki, {
    themes: { light: 'github-light-default', dark: 'github-dark-default' },
    defaultColor: false,
    fallbackLanguage: 'text',
    lazy: true,
  })
  .use(function signal() {
    return (tree: Root, file) => {
      const d = file.data as Data;
      return rehypeSignal(d.options, d.headings)(tree);
    };
  })
  // a "#" link on every heading so a section can be shared (added after the TOC text was collected)
  .use(function anchors() {
    return (tree: Root, file) => {
      const lang = (file.data as Data).options.lang ?? 'en';
      const run = rehypeAutolinkHeadings({
        behavior: 'append',
        test: (node) => node.properties?.id !== 'footnote-label',
        properties: { className: ['anchor'], ariaLabel: ANCHOR_LABEL[lang] },
        content: { type: 'text', value: '#' },
      });
      return run(tree);
    };
  })
  .use(rehypeStringify)
  .freeze();

export async function renderMarkdown(md: string, options: RenderOptions): Promise<Rendered> {
  if (!md.trim()) return { html: '', headings: [] };
  const headings: Heading[] = [];
  const file = await processor.process({ value: md, data: { options, headings } });
  return { html: String(file), headings };
}

/** ~200 words per minute, never below one minute. */
export function readingMinutes(md: string): number {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

import rehypeShiki from '@shikijs/rehype';
import type { Element, Root } from 'hast';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface Heading {
  id: string;
  text: string;
}
export interface Rendered {
  html: string;
  headings: Heading[];
}
export interface RenderOptions {
  /** Maps the filename in `![](img:<filename>)` to a browser URL. */
  resolveImage: (filename: string) => string;
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
          h('span', {}, [{ type: 'text', value: `/${String(n).padStart(2, '0')}` }]),
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
  .use(remarkRehype) // raw HTML in the source is dropped, never passed through
  .use(rehypeSlug)
  .use(rehypeTerm)
  .use(rehypeShiki, {
    themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
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

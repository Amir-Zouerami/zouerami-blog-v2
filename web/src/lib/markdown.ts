import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import type { Element, Root } from 'hast';
import { toString as mdText } from 'mdast-util-to-string';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex, { type Options as KatexOptions } from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { bundledLanguages, createHighlighter, type Highlighter } from 'shiki';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { faDigits } from '../i18n/format';
import { postSlugs, type Reference, type ResolvedPost, remarkReferences } from './references';

export interface Heading {
  id: string;
  text: string;
}
export interface Rendered {
  html: string;
  headings: Heading[];
  /** The sources cited with `[@key]`, numbered in order of first citation (see lib/references.ts). */
  references: Reference[];
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
  /** Marks blocks with `data-line` (their line in the source) so the editor preview can scroll in step with the text. */
  sourceLines?: boolean;
  /** Looks up a published post for `[@post:slug]`; without it those markers stay as typed. */
  resolvePost?: (slug: string) => Promise<ResolvedPost | null>;
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
        parent.children[index] = h(
          'div',
          { className: ['mermaid-block'], 'data-mermaid': '', dataLine: node.properties?.dataLine },
          [h('pre', { className: ['mermaid-src'] }, [{ type: 'text', value: src }])],
        );
        return 'skip';
      }
      parent.children[index] = h(
        'div',
        { className: ['term'], dataLine: node.properties?.dataLine },
        [
          h('div', { className: ['tb'] }, [
            h('span', {}, [{ type: 'text', value: lang }]),
            h('button', { className: ['copy'], type: 'button' }, [{ type: 'text', value: 'copy' }]),
          ]),
          node,
        ],
      );
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

const LINE_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'table',
  'tr',
  'figure',
  'aside',
  'hr',
]);

/** Adds `data-line` (the line in the text the author typed) to blocks; only used for the editor preview. */
function rehypeSourceLines(lineMap: number[]) {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const line = node.position?.start.line;
      if (line && LINE_TAGS.has(node.tagName))
        node.properties.dataLine = String(lineMap[line - 1] ?? line);
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

// Built once. `@shikijs/rehype` on its own spent ~10 s on its very first document (it prepares for every bundled
// language), which made the first post after each start hang. So we create the highlighter ourselves with just the
// languages in use and load others on demand, before a document is processed.
type Data = {
  options: RenderOptions;
  headings: Heading[];
  resolved: Map<string, ResolvedPost>;
  references: Reference[];
  /** the source line (1-based) behind each line the parser saw, after `$$` lines were split */
  lineMap: number[];
};
const KATEX: KatexOptions = { strict: 'ignore', output: 'htmlAndMathml' };
const THEMES = { light: 'github-light-default', dark: 'github-dark-default' } as const;
const COMMON_LANGS = [
  'text',
  'ts',
  'tsx',
  'js',
  'json',
  'bash',
  'sh',
  'yaml',
  'html',
  'css',
  'sql',
  'go',
  'python',
  'dockerfile',
  'nginx',
  'diff',
  'markdown',
];

function buildProcessor(highlighter: Highlighter) {
  return (
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkDirective)
      .use(function callouts() {
        return (tree, file) =>
          remarkCallouts((file.data as Data).options.lang ?? 'en')(tree as never);
      })
      .use(function references() {
        return (tree, file) => {
          const d = file.data as Data;
          remarkReferences(d.resolved, d.references)(tree as never);
        };
      })
      .use(remarkRehype) // raw HTML in the source is dropped, never passed through
      .use(function sourceLines() {
        return (tree: Root, file) => {
          const d = file.data as Data;
          if (d.options.sourceLines) rehypeSourceLines(d.lineMap)(tree);
        };
      })
      .use(rehypeSlug)
      // formulas are typeset on the server (no client JavaScript); a broken formula shows its source, never an error
      .use(rehypeKatex, KATEX)
      .use(rehypeTerm)
      .use(rehypeShikiFromHighlighter, highlighter, {
        themes: THEMES,
        defaultColor: false,
        fallbackLanguage: 'text',
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
      .freeze()
  );
}

let ready:
  | Promise<{ highlighter: Highlighter; processor: ReturnType<typeof buildProcessor> }>
  | undefined;
function engine() {
  ready ??= createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: COMMON_LANGS }).then(
    (highlighter) => ({ highlighter, processor: buildProcessor(highlighter) }),
  );
  return ready;
}

/** Starts creating the highlighter now (call at boot); resolves when markdown can be rendered without a cold start. */
export const warmMarkdownEngine = (): Promise<unknown> => engine();

/**
 * `$$ … $$` alone on one line means a display formula (remark-math would make it inline): put the markers on
 * their own lines. `lines[i]` is the line of the original text that output line i+1 came from.
 */
function expandDisplayMath(md: string): { text: string; lines: number[] } {
  let fence = '';
  const out: string[] = [];
  const lines: number[] = [];
  const src = md.split('\n');
  for (let i = 0; i < src.length; i++) {
    const line = src[i] ?? '';
    const emit = (...ls: string[]) => {
      for (const l of ls) {
        out.push(l);
        lines.push(i + 1);
      }
    };
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (f) {
      if (!fence) fence = f;
      else if (f[0] === fence[0] && f.length >= fence.length) fence = '';
      emit(line);
      continue;
    }
    const m = fence ? null : /^( {0,3})\$\$(?!\$)(.+?)\$\$\s*$/.exec(line);
    if (m) emit(`${m[1]}$$`, m[2]?.trim() ?? '', `${m[1]}$$`);
    else emit(line);
  }
  return { text: out.join('\n'), lines };
}
export const displayMath = (md: string): string => expandDisplayMath(md).text;

const FENCE = /^ {0,3}(?:`{3,}|~{3,})\s*([A-Za-z0-9_+#.-]+)/gm;

export async function renderMarkdown(md: string, options: RenderOptions): Promise<Rendered> {
  if (!md.trim()) return { html: '', headings: [], references: [] };
  const { highlighter, processor } = await engine();
  // load the grammars this document needs (unknown names fall back to plain text)
  const loaded = new Set(highlighter.getLoadedLanguages());
  const wanted = new Set<string>();
  for (const m of md.matchAll(FENCE)) {
    const name = (m[1] ?? '').toLowerCase();
    if (name in bundledLanguages && !loaded.has(name)) wanted.add(name);
  }
  if (wanted.size)
    await Promise.all([...wanted].map((l) => highlighter.loadLanguage(l as never).catch(() => {})));
  const headings: Heading[] = [];
  const references: Reference[] = [];
  const resolved = new Map<string, ResolvedPost>();
  if (options.resolvePost) {
    const resolve = options.resolvePost;
    await Promise.all(
      postSlugs(md).map(async (slug) => {
        const post = await resolve(slug).catch(() => null);
        if (post) resolved.set(`post:${slug}`, post);
      }),
    );
  }
  // Markdown only treats `[text][@key]` as a reference when a definition exists: give every resolved post one
  // (definitions are never printed). Posts that could not be found get none and stay as typed.
  const postDefs = [...resolved.keys()].map((key) => `[@${key}]: /blog/${key.slice(5)}`);
  const { text: body, lines: lineMap } = expandDisplayMath(md);
  const source = postDefs.length ? `${body}\n\n${postDefs.join('\n')}\n` : body;
  const file = await processor.process({
    value: source,
    data: { options, headings, resolved, references, lineMap },
  });
  return { html: String(file), headings, references };
}

/** ~200 words per minute, never below one minute. */
export function readingMinutes(md: string): number {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

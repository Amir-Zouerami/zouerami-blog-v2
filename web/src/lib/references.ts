/**
 * References: numbered citations inside a post and the "References" box under it.
 *
 *   Inline            [@key]                 a numbered marker
 *                     [the phrase][@key]     the phrase is highlighted and followed by the marker
 *                     [@post:some-slug]      another post of this blog (title, date and link come from the site)
 *   Definition        [@key]: https://… "Title | by: Authors, 2025 | fig: 1.8× = more requests per second | note: Why it matters | type: benchmark"
 *
 * It is plain Markdown reference-link syntax: `[x][@key]` and `[@key]` are link references and `[@key]: url "title"` is a
 * link definition, so the text stays readable anywhere. This module turns them into markers in the prose and a list of
 * references for the box. Numbers follow the first citation; a definition that is never cited is not shown; a key
 * without a definition stays as the literal text the author typed.
 */
import { toString as mdText } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';

export const REF_TYPES = [
  'benchmark',
  'paper',
  'code',
  'docs',
  'video',
  'article',
  'post',
  'link',
] as const;
export type RefType = (typeof REF_TYPES)[number];

export interface Reference {
  /** Position in the list, from 1, in order of first citation. */
  n: number;
  key: string;
  type: RefType;
  title: string;
  url: string;
  domain: string;
  path: string;
  by?: string;
  fig?: { value: string; label?: string };
  note?: string;
  /** Only for references to posts of this blog. */
  post?: { slug: string; date: string; tags: string[]; cover: string | null };
  /** Every place the reference is cited: `k` counts the markers in the prose from 0, `text` is the passage. */
  cites: { k: number; text: string }[];
}

/** What the page supplies for `[@post:slug]`: the published post, in the reader's language, or null. */
export interface ResolvedPost {
  slug: string;
  title: string;
  url: string;
  domain: string;
  path: string;
  date: string;
  tags: string[];
  cover: string | null;
}

type MdNode = {
  type: string;
  identifier?: string;
  label?: string;
  referenceType?: string;
  url?: string;
  title?: string | null;
  children?: MdNode[];
  value?: string;
  data?: Record<string, unknown>;
};

const MAX = { title: 200, note: 420, by: 140, figValue: 24, figLabel: 90 };
const KEY = /^[a-z0-9][a-z0-9._:-]{0,63}$/;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Slugs of the `[@post:slug]` markers in a Markdown source (so the page can look them up before rendering). */
export function postSlugs(md: string): string[] {
  const out = new Set<string>();
  for (const m of md.matchAll(/\[@post:([a-z0-9]+(?:-[a-z0-9]+)*)\]/gi))
    out.add((m[1] as string).toLowerCase());
  return [...out];
}

/** Only web links and site paths: nothing that can run code. */
export function safeUrl(url: string | undefined | null): string | null {
  const u = (url ?? '').trim();
  if (/^https?:\/\//i.test(u)) {
    try {
      return new URL(u).href;
    } catch {
      return null;
    }
  }
  return /^\/(?!\/)/.test(u) ? u : null;
}

export function splitUrl(url: string): { domain: string; path: string } {
  if (url.startsWith('/')) return { domain: '', path: clip(url, 70) };
  const u = new URL(url);
  const path = decodeURI(u.pathname === '/' ? '' : u.pathname) + u.search;
  return { domain: u.hostname.replace(/^www\./, ''), path: clip(path, 70) };
}

const HOST = {
  code: /(^|\.)(github|gitlab|codeberg|bitbucket|sr)\.(com|org|ht)$/,
  paper:
    /(^|\.)(arxiv\.org|doi\.org|acm\.org|ieee\.org|openreview\.net|semanticscholar\.org|researchgate\.net|nature\.com|science\.org|springer\.com|sciencedirect\.com|usenix\.org|aclanthology\.org|jstor\.org|plos\.org)$/,
  video: /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|aparat\.com)$/,
};

/** A good guess from the address, so most references need no `type:` field. */
export function detectType(domain: string, path: string, title: string): RefType {
  if (HOST.code.test(domain)) return 'code';
  if (HOST.paper.test(domain)) return 'paper';
  if (HOST.video.test(domain)) return 'video';
  if (/bench/i.test(`${domain}${path} ${title}`)) return 'benchmark';
  if (/^(docs|developer|developers|man)\./.test(domain) || /readthedocs|mozilla\.org/.test(domain))
    return 'docs';
  if (/\/(docs?|documentation|api|reference|manual|guide|man)(\/|$)/i.test(path)) return 'docs';
  return 'link';
}

interface Parsed {
  title: string;
  fields: Partial<Record<'type' | 'by' | 'fig' | 'note', string>>;
}

/** `"Title | by: … | fig: 1.8× = label | note: … | type: paper"`: the title first, then named fields in any order. */
export function parseDefinitionTitle(raw: string | null | undefined): Parsed {
  const parts = (raw ?? '').split(/\s\|\s/).map((p) => p.trim());
  const title = parts.shift() ?? '';
  const fields: Parsed['fields'] = {};
  for (const part of parts) {
    const m = /^(type|by|fig|note)\s*:\s*(.+)$/is.exec(part);
    if (m)
      fields[(m[1] as string).toLowerCase() as keyof Parsed['fields']] = (m[2] as string).trim();
  }
  return { title, fields };
}

function fromDefinition(key: string, def: MdNode): Omit<Reference, 'n' | 'cites'> | null {
  const url = safeUrl(def.url);
  if (!url) return null;
  const { domain, path } = splitUrl(url);
  const { title, fields } = parseDefinitionTitle(def.title);
  const wanted = (fields.type ?? '').toLowerCase();
  const type =
    (REF_TYPES as readonly string[]).includes(wanted) && wanted !== 'post'
      ? (wanted as RefType)
      : detectType(domain, path, title);
  const ref: Omit<Reference, 'n' | 'cites'> = {
    key,
    type,
    title: clip(title || domain || url, MAX.title),
    url,
    domain,
    path,
  };
  if (fields.by) ref.by = clip(fields.by, MAX.by);
  if (fields.note) ref.note = clip(fields.note, MAX.note);
  if (fields.fig) {
    const i = fields.fig.indexOf('=');
    const value = clip((i < 0 ? fields.fig : fields.fig.slice(0, i)).trim(), MAX.figValue);
    const label = i < 0 ? '' : fields.fig.slice(i + 1).trim();
    if (value) ref.fig = label ? { value, label: clip(label, MAX.figLabel) } : { value };
  }
  return ref;
}

function fromPost(
  key: string,
  post: ResolvedPost | undefined,
): Omit<Reference, 'n' | 'cites'> | null {
  if (!post) return null;
  return {
    key,
    type: 'post',
    title: clip(post.title, MAX.title),
    url: post.url,
    domain: post.domain,
    path: post.path,
    post: { slug: post.slug, date: post.date, tags: post.tags, cover: post.cover },
  };
}

/** The few words before a bare marker, for the tooltip of the reading map and the "cited in" dots. */
function wordsBefore(parent: MdNode, index: number): string {
  const text = mdText({
    type: 'paragraph',
    children: (parent.children ?? []).slice(0, index),
  } as never)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 90 ? `…${text.slice(-90).replace(/^\S*\s/, '')}` : text;
}

/**
 * Turns `[@key]` / `[phrase][@key]` into markers and fills `sink` with the numbered references.
 * `resolved` holds the posts found for `[@post:slug]` (keys look like `post:slug`).
 */
export function remarkReferences(resolved: Map<string, ResolvedPost>, sink: Reference[]) {
  return (tree: MdNode) => {
    const defs = new Map<string, MdNode>();
    visit(tree as never, 'definition', (raw: unknown) => {
      const node = raw as MdNode;
      const id = (node.identifier ?? '').toLowerCase();
      if (id.startsWith('@') && KEY.test(id.slice(1))) defs.set(id.slice(1), node);
      return undefined;
    });

    const byKey = new Map<string, Reference>();
    let k = 0;
    visit(
      tree as never,
      'linkReference',
      (raw: unknown, index: number | undefined, rawParent: unknown) => {
        const node = raw as MdNode;
        const parent = rawParent as MdNode | undefined;
        if (!parent?.children || index === undefined) return undefined;
        const id = (node.identifier ?? '').toLowerCase();
        if (!id.startsWith('@') || !KEY.test(id.slice(1))) return undefined;
        const key = id.slice(1);

        let ref = byKey.get(key);
        if (!ref) {
          const def = defs.get(key);
          const base = key.startsWith('post:')
            ? fromPost(key, resolved.get(key))
            : def
              ? fromDefinition(key, def)
              : null;
          if (!base) return undefined; // unknown key: stays the literal text
          ref = { ...base, n: sink.length + 1, cites: [] };
          byKey.set(key, ref);
          sink.push(ref);
        }

        const phrase = node.referenceType === 'full' && (node.children?.length ?? 0) > 0;
        ref.cites.push({
          k,
          text: phrase
            ? mdText(node as never)
                .replace(/\s+/g, ' ')
                .trim()
            : wordsBefore(parent, index),
        });
        const marker: MdNode = {
          type: 'referenceMarker',
          data: {
            hName: 'a',
            hProperties: {
              href: `#ref-${ref.n}`,
              className: ['ref-cite', `t-${ref.type}`],
              dataRef: key,
              dataK: k,
              dataN: ref.n,
              ariaLabel: `Reference ${ref.n}: ${ref.title}`,
            },
            hChildren: [{ type: 'text', value: String(ref.n) }],
          },
        };
        k += 1;
        parent.children[index] = phrase
          ? {
              type: 'referenceClaim',
              children: [...(node.children ?? []), marker],
              data: {
                hName: 'span',
                hProperties: { className: ['ref-claim', `t-${ref.type}`], dataRef: key },
              },
            }
          : marker;
        return 'skip';
      },
    );
  };
}

/** Script of the author's text: Persian text gets the Persian font and direction rules of the site. */
export const textLang = (s: string): 'fa' | 'en' => (/[؀-ۿ]/.test(s) ? 'fa' : 'en');

import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown';
import {
  detectType,
  parseDefinitionTitle,
  postSlugs,
  type ResolvedPost,
  safeUrl,
  splitUrl,
  textLang,
} from '../../src/lib/references';

const opts = { resolveImage: (n: string) => n, lang: 'en' as const };
const post: ResolvedPost = {
  slug: 'pocketbase-in-production',
  title: 'PocketBase in production',
  url: '/blog/pocketbase-in-production',
  domain: 'amir-zouerami.dev',
  path: '/blog/pocketbase-in-production',
  date: '2026-10-18',
  tags: ['DevOps'],
  cover: null,
};

describe('definition titles', () => {
  it('splits the title from named fields, in any order', () => {
    const p = parseDefinitionTitle(
      'The Tail at Scale | note: Why p99 matters | by: Dean, 2013 | fig: p99 = not the mean | type: paper',
    );
    expect(p.title).toBe('The Tail at Scale');
    expect(p.fields).toEqual({
      note: 'Why p99 matters',
      by: 'Dean, 2013',
      fig: 'p99 = not the mean',
      type: 'paper',
    });
  });
  it('ignores unknown fields and handles a bare title', () => {
    expect(parseDefinitionTitle('Only a title').fields).toEqual({});
    expect(parseDefinitionTitle('T | colour: red').fields).toEqual({});
    expect(parseDefinitionTitle(null)).toEqual({ title: '', fields: {} });
  });
});

describe('addresses', () => {
  it('allows web links and site paths only', () => {
    expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeUrl('/blog/x')).toBe('/blog/x');
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      '//evil.example',
      'mailto:a@b.c',
      '',
      'ftp://x',
    ]) {
      expect(safeUrl(bad), bad).toBeNull();
    }
  });
  it('splits domain and path', () => {
    expect(splitUrl('https://www.github.com/fastify/fastify')).toEqual({
      domain: 'github.com',
      path: '/fastify/fastify',
    });
    expect(splitUrl('https://example.com/')).toEqual({ domain: 'example.com', path: '' });
    expect(splitUrl('/blog/x')).toEqual({ domain: '', path: '/blog/x' });
  });
  it('guesses the type from the address', () => {
    expect(detectType('github.com', '/a/b', 'x')).toBe('code');
    expect(detectType('arxiv.org', '/abs/1', 'x')).toBe('paper');
    expect(detectType('youtube.com', '/watch', 'x')).toBe('video');
    expect(detectType('nodejs.org', '/api/worker_threads.html', 'x')).toBe('docs');
    expect(detectType('docs.python.org', '/3/', 'x')).toBe('docs');
    expect(detectType('example.com', '/', 'HTTP benchmark results')).toBe('benchmark');
    expect(detectType('example.com', '/post', 'Some article')).toBe('link');
  });
  it('detects the script of the text', () => {
    expect(textLang('کانکشن روی سرور ۴ هسته‌ای')).toBe('fa');
    expect(textLang('plain English')).toBe('en');
  });
  it('finds the post slugs in a source', () => {
    expect(postSlugs('a [@post:one-two] b [text][@post:three] c [@post:ONE-two] [@bench]')).toEqual(
      ['one-two', 'three'],
    );
  });
});

describe('citations in a rendered post', () => {
  const md = [
    'First [the slow tail][@tail] then a bare one [@bench] and again [@tail].',
    '',
    'Mine: [my notes][@post:pocketbase-in-production].',
    '',
    '[@bench]: https://example.com/bench "HTTP benchmark | fig: 1.8× = more requests per second | note: warm cache | by: Example, 2026"',
    '[@tail]: https://cacm.acm.org/research/the-tail-at-scale/ "The Tail at Scale | by: Dean & Barroso, 2013"',
    '[@unused]: https://example.org/ "Never cited"',
  ].join('\n');

  it('numbers references by first citation and counts the citations', async () => {
    const { references } = await renderMarkdown(md, { ...opts, resolvePost: async () => post });
    expect(references.map((r) => [r.n, r.key, r.type, r.cites.length])).toEqual([
      [1, 'tail', 'paper', 2],
      [2, 'bench', 'benchmark', 1],
      [3, 'post:pocketbase-in-production', 'post', 1],
    ]);
    expect(references[1]?.fig).toEqual({ value: '1.8×', label: 'more requests per second' });
    expect(references[1]?.note).toBe('warm cache');
    expect(references[0]?.by).toBe('Dean & Barroso, 2013');
    expect(references[2]?.post?.date).toBe('2026-10-18');
  });

  it('never lists a definition that is not cited', async () => {
    const { references } = await renderMarkdown(md, { ...opts, resolvePost: async () => post });
    expect(references.some((r) => r.key === 'unused')).toBe(false);
  });

  it('turns a phrase into a highlighted claim followed by the marker, and a bare key into a marker', async () => {
    const { html } = await renderMarkdown(md, { ...opts, resolvePost: async () => post });
    expect(html).toContain('<span class="ref-claim t-paper" data-ref="tail">the slow tail<a');
    expect(html).toContain('class="ref-cite t-paper"');
    expect(html).toContain('href="#ref-1"');
    expect(html).toContain('data-n="2"');
    expect(html).toMatch(/bare one <a[^>]*data-ref="bench"/);
    expect(html).toContain('aria-label="Reference 1: The Tail at Scale"');
    expect(html).not.toContain('[@');
  });

  it('numbers the markers in the text from zero and records the passage', async () => {
    const { references, html } = await renderMarkdown(md, {
      ...opts,
      resolvePost: async () => post,
    });
    expect(html.match(/data-k="(\d+)"/g)).toEqual([
      'data-k="0"',
      'data-k="1"',
      'data-k="2"',
      'data-k="3"',
    ]);
    expect(references[0]?.cites[0]?.text).toBe('the slow tail');
    expect(references[1]?.cites[0]?.text).toContain('a bare one');
  });

  it('keeps an unknown key or an unresolved post exactly as typed', async () => {
    const { html, references } = await renderMarkdown(
      'See [@nope] and [@post:missing] and [@someone] today.',
      {
        ...opts,
        resolvePost: async () => null,
      },
    );
    expect(references).toEqual([]);
    expect(html).toContain('[@nope]');
    expect(html).toContain('[@post:missing]');
  });

  it('refuses addresses that can run code', async () => {
    const { html, references } = await renderMarkdown(
      'x [@bad]\n\n[@bad]: javascript:alert(1) "Evil"',
      opts,
    );
    expect(references).toEqual([]);
    expect(html).not.toContain('javascript:');
  });

  it('escapes the author text', async () => {
    const { references, html } = await renderMarkdown(
      'x [@a]\n\n[@a]: https://example.com "<img src=x onerror=1> | note: <b>hi</b>"',
      opts,
    );
    expect(references[0]?.title).toBe('<img src=x onerror=1>');
    // the text can only appear inside an attribute value, never as an element
    expect(html.replace(/aria-label="[^"]*"/g, '')).not.toContain('<img');
  });

  it('does not touch ordinary links, footnotes or @ mentions', async () => {
    const { html, references } = await renderMarkdown(
      'A [link](https://example.com), a note[^1], and @someone.\n\n[^1]: The note.',
      opts,
    );
    expect(references).toEqual([]);
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('@someone');
  });

  it('works in a Persian post', async () => {
    const fa = await renderMarkdown(
      'نتیجه [پول کوچک‌تر][@pool] بهتر بود.\n\n[@pool]: https://example.com "Postgres pool | note: کانکشن روی سرور ۴ هسته‌ای از پول‌های بزرگ‌تر بهتر بود"',
      {
        ...opts,
        lang: 'fa',
      },
    );
    expect(fa.references[0]?.note).toContain('هسته‌ای');
    expect(fa.html).toContain('ref-claim');
  });
});

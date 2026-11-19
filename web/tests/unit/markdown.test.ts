import { describe, expect, it } from 'vitest';
import { readingMinutes, renderMarkdown } from '../../src/lib/markdown';

const opts = { resolveImage: (n: string) => `/pb/api/files/posts/ID/${n}` };

describe('renderMarkdown', { timeout: 30000 }, () => {
  it('numbers h2 headings /01 /02 and returns them for the TOC with stable ids', async () => {
    const { html, headings } = await renderMarkdown('## One\n\ntext\n\n## Two\n', opts);
    expect(headings).toEqual([
      { id: 'one', text: 'One' },
      { id: 'two', text: 'Two' },
    ]);
    expect(html).toContain('<h2 id="one"><span>/01</span>One<a class="anchor"');
    expect(html).toContain('<span>/02</span>Two');
  });

  it('gives Persian headings usable ids', async () => {
    const { headings } = await renderMarkdown('## مشکلِ زیادی‌کاری\n', opts);
    expect(headings[0]?.id).toBeTruthy();
    expect(headings[0]?.text).toBe('مشکلِ زیادی‌کاری');
  });

  it('resolves img: references to PocketBase file URLs and wraps them in a figure', async () => {
    const { html } = await renderMarkdown('![Fig. 1 caption](img:pic_abc.png)', opts);
    expect(html).toContain('src="/pb/api/files/posts/ID/pic_abc.png"');
    expect(html).toContain('<figure>');
    expect(html).toContain('<figcaption>Fig. 1 caption</figcaption>');
    expect(html).toContain('loading="lazy"');
  });

  it('highlights fenced code with shiki and wraps it in the terminal block with a copy button', async () => {
    const { html } = await renderMarkdown('```ts\nconst a: number = 1;\n```', opts);
    expect(html).toContain('class="term"');
    expect(html).toContain('<span>ts</span>');
    expect(html).toContain('class="copy"');
    expect(html).toContain('shiki');
  });

  it('does not crash on an unknown code language', async () => {
    const { html } = await renderMarkdown('```nonsenselang\nx\n```', opts);
    expect(html).toContain('class="term"');
  });

  it('never emits raw HTML or script from the markdown source', async () => {
    const { html } = await renderMarkdown(
      'hi <script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))',
      opts,
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it('opens external links safely and keeps internal links in the tab', async () => {
    const { html } = await renderMarkdown('[a](https://example.com) [b](/blog)', opts);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('<a href="/blog">b</a>');
  });

  it('renders GFM footnotes, lists and blockquotes', async () => {
    const { html } = await renderMarkdown(
      '> quote\n\n- a\n- b\n\nnote[^1]\n\n[^1]: the note',
      opts,
    );
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('the note');
  });

  it('handles empty input', async () => {
    expect(await renderMarkdown('', opts)).toEqual({ html: '', headings: [], references: [] });
  });
});

describe('diagrams, heading levels and themes', () => {
  it('turns mermaid fences into a diagram block (source kept as text, not highlighted)', async () => {
    const { html } = await renderMarkdown('```mermaid\nflowchart LR\n  A --> B\n```', opts);
    expect(html).toContain('class="mermaid-block"');
    expect(html).toContain('<pre class="mermaid-src">flowchart LR');
    expect(html).toContain('A --');
    expect(html).not.toContain('class="term"');
    expect(html).not.toContain('shiki');
  });
  it('keeps ordinary fences as code blocks next to a diagram', async () => {
    const { html } = await renderMarkdown(
      '```mermaid\nA-->B\n```\n\n```ts\nconst a = 1\n```',
      opts,
    );
    expect(html.match(/mermaid-block/g)).toHaveLength(1);
    expect(html).toContain('class="term"');
  });
  it('gives h3–h6 ids but numbers and lists only h2 in the TOC', async () => {
    const { html, headings } = await renderMarkdown(
      '## A\n\n### B\n\n#### C\n\n##### D\n\n###### E',
      opts,
    );
    for (const t of ['h3', 'h4', 'h5', 'h6']) expect(html).toMatch(new RegExp(`<${t} id="[a-z]"`));
    expect(headings).toEqual([{ id: 'a', text: 'A' }]);
    expect(html).not.toContain('<h3 id="b"><span>');
  });
  it('uses Persian numerals for Persian posts', async () => {
    const fa = await renderMarkdown('## الف\n\n## ب', { ...opts, numerals: 'fa' });
    expect(fa.html).toContain('<span>/۰۱</span>');
    expect(fa.html).toContain('<span>/۰۲</span>');
  });
  it('highlights code with the GitHub Dark palette', async () => {
    const { html } = await renderMarkdown('```ts\nconst a = 1\n```', opts);
    expect(html).toContain('--shiki-dark-bg:#0d1117');
  });
});

describe('readingMinutes', () => {
  it('is at least 1 and scales with length', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(400))).toBe(2);
    expect(readingMinutes('word '.repeat(2000))).toBe(10);
  });
});

describe('highlighter start-up', { timeout: 30000 }, () => {
  const o = { resolveImage: (n: string) => n, lang: 'en' as const };
  it('the first document renders quickly (no multi-second cold start)', async () => {
    const t = performance.now();
    await renderMarkdown('hello', o);
    expect(performance.now() - t).toBeLessThan(4000);
  });
  it('highlights languages that are not preloaded, and falls back to plain text for unknown ones', async () => {
    const rust = await renderMarkdown('```rust\nfn main() {}\n```', o);
    expect(rust.html).toContain('style=');
    const odd = await renderMarkdown('```notalanguage\nx\n```', o);
    expect(odd.html).toContain('<pre');
  });
});

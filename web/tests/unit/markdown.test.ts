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
    expect(html).toContain('<h2 id="one"><span>/01</span>One</h2>');
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
    expect(await renderMarkdown('', opts)).toEqual({ html: '', headings: [] });
  });
});

describe('readingMinutes', () => {
  it('is at least 1 and scales with length', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(400))).toBe(2);
    expect(readingMinutes('word '.repeat(2000))).toBe(10);
  });
});

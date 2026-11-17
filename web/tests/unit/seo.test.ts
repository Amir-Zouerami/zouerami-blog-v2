import { describe, expect, it } from 'vitest';
import { buildSitemap, robotsTxt, rssXml, xmlEscape } from '../../src/lib/feeds';
import { blogPostingLd, breadcrumbLd, personLd } from '../../src/lib/jsonld';
import { ogSvg, renderOg, wrapTitle } from '../../src/lib/og';
import type { PostSummary, ProjectSummary } from '../../src/lib/schemas';

const SITE = 'https://amir-zouerami.dev';
const post = (o: Partial<PostSummary>): PostSummary => ({
  featured: false,
  slug: 'a',
  date: '2026-11-02 12:00:00.000Z',
  tags: ['Web'],
  langs: ['en'],
  titleLang: 'en',
  title: 'A & B <title>',
  summary: 'S "q"',
  cover: null,
  ...o,
});

describe('sitemap', () => {
  const xml = buildSitemap(
    SITE,
    [
      post({ slug: 'both', langs: ['en', 'fa'] }),
      post({ slug: 'fa-only', langs: ['fa'], titleLang: 'fa' }),
    ],
    [{ slug: 'lumen' } as ProjectSummary],
  );
  it('lists both languages for bilingual posts with hreflang pairs and x-default', () => {
    expect(xml).toContain('<loc>https://amir-zouerami.dev/blog/both</loc>');
    expect(xml).toContain('<loc>https://amir-zouerami.dev/fa/blog/both</loc>');
    expect(xml).toContain('hreflang="x-default" href="https://amir-zouerami.dev/blog/both"');
  });
  it('lists only the existing language for single-language posts', () => {
    expect(xml).toContain('<loc>https://amir-zouerami.dev/fa/blog/fa-only</loc>');
    expect(xml).not.toContain('<loc>https://amir-zouerami.dev/blog/fa-only</loc>');
    expect(xml).not.toContain('hreflang="en" href="https://amir-zouerami.dev/blog/fa-only"');
  });
  it('includes static pages and projects in both languages', () => {
    for (const p of [
      '/',
      '/fa',
      '/blog',
      '/fa/blog',
      '/work/lumen',
      '/fa/work/lumen',
      '/about',
      '/fa/about',
      '/cv',
      '/fa/cv',
    ])
      expect(xml).toContain(`<loc>${p === '/' ? `${SITE}/` : SITE + p}</loc>`);
  });
  it('never lists private pages', () => {
    expect(xml).not.toMatch(/\/account|\/login|\/api\//);
  });
});

describe('rss + robots + escaping', () => {
  it('escapes XML and links to the right language', () => {
    const xml = rssXml(SITE, 'fa', [post({ slug: 'x' })]);
    expect(xml).toContain('A &amp; B &lt;title&gt;');
    expect(xml).toContain('<link>https://amir-zouerami.dev/fa/blog/x</link>');
    expect(xml).toContain('<language>fa-IR</language>');
    expect(xml).not.toContain('<title>A & B');
  });
  it('is valid for an empty feed', () => {
    expect(rssXml(SITE, 'en', [])).toContain('<channel>');
  });
  it('xmlEscape handles all five characters', () => {
    expect(xmlEscape(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
  it('robots points at the sitemap and blocks api/account', () => {
    const r = robotsTxt(SITE);
    expect(r).toContain('Sitemap: https://amir-zouerami.dev/sitemap.xml');
    expect(r).toContain('Disallow: /api/');
    expect(r).toContain('Disallow: /account');
    for (const p of ['/pb/', '/fa/forgot', '/fa/reset', '/fa/verify', '/unsubscribe'])
      expect(r).toContain(`Disallow: ${p}`);
  });
});

describe('json-ld', () => {
  it('Person has the Latin name, Persian alternateName and sameAs', () => {
    const p = personLd(SITE);
    expect(p.name).toBe('Amir Zouerami');
    expect(p.alternateName).toBe('امیر زوارمی');
    expect(p.sameAs.length).toBeGreaterThanOrEqual(2);
  });
  it('BlogPosting carries language, dates and absolute URLs', () => {
    const d = blogPostingLd({
      site: SITE,
      slug: 'a',
      title: 'T',
      description: 'D',
      lang: 'fa',
      date: '2026-11-02 12:00:00.000Z',
      tags: ['x', 'y'],
      image: '/og/fa/a.png',
      path: '/fa/blog/a',
    });
    expect(d.inLanguage).toBe('fa-IR');
    expect(d.datePublished).toBe('2026-11-02T12:00:00.000Z');
    expect(d.image).toBe('https://amir-zouerami.dev/og/fa/a.png');
    expect(d.keywords).toBe('x, y');
  });
  it('breadcrumbs are positioned from 1', () => {
    const b = breadcrumbLd(SITE, [
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });
});

describe('og image', () => {
  it('wraps long titles and truncates beyond four lines', () => {
    const lines = wrapTitle('word '.repeat(80), 'en', 72, 1056, 4);
    expect(lines).toHaveLength(4);
    expect(lines[3]?.endsWith('…')).toBe(true);
  });
  it('escapes markup in titles', () => {
    expect(ogSvg({ title: '<script>x</script> & "q"', lang: 'en' })).not.toContain('<script>');
  });
  it('renders a real 1200×630 PNG for English and Persian (Arabic-script shaping spike)', () => {
    for (const lang of ['en', 'fa'] as const) {
      const png = renderOg({
        title: lang === 'fa' ? 'چرا دوباره وبلاگم را از نو ساختم' : 'Hello',
        lang,
      });
      expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
      const w = new DataView(png.buffer, png.byteOffset).getUint32(16);
      const h = new DataView(png.buffer, png.byteOffset).getUint32(20);
      expect([w, h]).toEqual([1200, 630]);
      expect(png.length).toBeGreaterThan(8000);
    }
  });
});

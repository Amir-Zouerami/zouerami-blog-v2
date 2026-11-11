import type { Locale } from '../i18n';
import { localePath } from '../i18n';
import type { PostSummary, ProjectSummary } from './schemas';

export const xmlEscape = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );

const abs = (site: string, path: string) => `${site.replace(/\/$/, '')}${path}`;
const rfc822 = (d: string) => new Date(d.replace(' ', 'T')).toUTCString();
const day = (d: string) => new Date(d.replace(' ', 'T')).toISOString().slice(0, 10);

/** RSS 2.0 for one language: only posts that exist in that language. */
export function rssXml(
  site: string,
  locale: Locale,
  posts: (PostSummary & { title: string })[],
): string {
  const channelTitle =
    locale === 'fa' ? 'zouerami — نوشته‌های امیر زوارمی' : 'zouerami — writing by Amir Zouerami';
  const desc =
    locale === 'fa'
      ? 'یادداشت‌هایی درباره وب، طراحی و تایپوگرافی فارسی.'
      : 'Notes on the web, design and Persian typography.';
  const items = posts
    .map((p) => {
      const url = abs(site, localePath(locale, `/blog/${p.slug}`));
      return `<item><title>${xmlEscape(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${rfc822(p.date)}</pubDate><description>${xmlEscape(p.summary)}</description>${p.tags.map((t) => `<category>${xmlEscape(t)}</category>`).join('')}</item>`;
    })
    .join('');
  const last = posts[0] ? `<lastBuildDate>${rfc822(posts[0].date)}</lastBuildDate>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(channelTitle)}</title><link>${abs(site, localePath(locale, '/'))}</link><description>${xmlEscape(desc)}</description><language>${locale === 'fa' ? 'fa-IR' : 'en'}</language><atom:link href="${abs(site, locale === 'fa' ? '/fa/rss.xml' : '/rss.xml')}" rel="self" type="application/rss+xml"/>${last}${items}</channel></rss>`;
}

interface Url {
  loc: string;
  alternates?: { lang: string; href: string }[];
  lastmod?: string;
}

/** Sitemap with xhtml:link language alternates (hreflang) per URL. */
export function sitemapXml(urls: Url[]): string {
  const body = urls
    .map(
      (u) =>
        `<url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${(u.alternates ?? []).map((a) => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${xmlEscape(a.href)}"/>`).join('')}</url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.w3.org/2005/Sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;
}

export function buildSitemap(
  site: string,
  posts: PostSummary[],
  projects: ProjectSummary[],
): string {
  const alt = (path: string, langs: Locale[]) => {
    const a = langs.map((l) => ({ lang: l, href: abs(site, localePath(l, path)) }));
    const en = a.find((x) => x.lang === 'en');
    return en ? [...a, { lang: 'x-default', href: en.href }] : a;
  };
  const urls: Url[] = [];
  for (const path of ['/', '/blog', '/work', '/about', '/privacy']) {
    for (const l of ['en', 'fa'] as Locale[]) {
      urls.push({ loc: abs(site, localePath(l, path)), alternates: alt(path, ['en', 'fa']) });
    }
  }
  for (const p of posts) {
    for (const l of p.langs) {
      urls.push({
        loc: abs(site, localePath(l, `/blog/${p.slug}`)),
        alternates: alt(`/blog/${p.slug}`, p.langs),
        lastmod: day(p.date),
      });
    }
  }
  for (const pr of projects) {
    // case studies are written in English; the Persian page mirrors it
    for (const l of ['en', 'fa'] as Locale[]) {
      urls.push({
        loc: abs(site, localePath(l, `/work/${pr.slug}`)),
        alternates: alt(`/work/${pr.slug}`, ['en', 'fa']),
      });
    }
  }
  return sitemapXml(urls);
}

export function robotsTxt(site: string): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /account
Disallow: /fa/account
Disallow: /login
Disallow: /fa/login
Disallow: /register
Disallow: /fa/register
Disallow: /forgot
Disallow: /reset
Disallow: /verify

Sitemap: ${abs(site, '/sitemap.xml')}
`;
}

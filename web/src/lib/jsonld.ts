import type { Locale } from '../i18n';

export const SITE_NAME = 'zouerami';
export const PERSON = {
  name: 'Amir Zouerami',
  alternateName: 'امیر زوارمی',
  sameAs: [
    'https://github.com/amirzouerami',
    'https://www.linkedin.com/in/amirzouerami',
    'https://x.com/amirzouerami',
  ],
};

const abs = (site: string, path: string) => `${site.replace(/\/$/, '')}${path}`;

export function personLd(site: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': abs(site, '/#person'),
    name: PERSON.name,
    alternateName: PERSON.alternateName,
    url: abs(site, '/'),
    sameAs: PERSON.sameAs,
  };
}

export function websiteLd(site: string, locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': abs(site, '/#website'),
    name: SITE_NAME,
    url: abs(site, locale === 'fa' ? '/fa' : '/'),
    inLanguage: locale === 'fa' ? 'fa-IR' : 'en',
    publisher: { '@id': abs(site, '/#person') },
  };
}

export interface PostLdInput {
  site: string;
  slug: string;
  title: string;
  description: string;
  lang: Locale;
  /** ISO or PocketBase "YYYY-MM-DD HH:mm:ss.SSSZ" */
  date: string;
  modified?: string;
  tags: string[];
  image: string;
  path: string;
}

const iso = (d: string) => new Date(d.replace(' ', 'T')).toISOString();

export function blogPostingLd(i: PostLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: i.title,
    description: i.description,
    inLanguage: i.lang === 'fa' ? 'fa-IR' : 'en',
    datePublished: iso(i.date),
    dateModified: iso(i.modified ?? i.date),
    keywords: i.tags.join(', '),
    image: abs(i.site, i.image),
    url: abs(i.site, i.path),
    mainEntityOfPage: abs(i.site, i.path),
    author: { '@id': abs(i.site, '/#person') },
    publisher: { '@id': abs(i.site, '/#person') },
  };
}

export function breadcrumbLd(site: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      item: abs(site, it.path),
    })),
  };
}

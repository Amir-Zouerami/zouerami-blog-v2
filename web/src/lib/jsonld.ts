import type { Locale } from '../i18n';
import { absoluteUrl } from './url';

export type JsonLd = Record<string, unknown>;

export const SITE_NAME = 'zouerami';
export const PERSON = {
  name: 'Amir Zouerami',
  alternateName: 'امیر زوارمی',
  sameAs: ['https://github.com/amir-zouerami', 'https://www.linkedin.com/in/amir-zouerami/'],
};

export function personLd(site: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': absoluteUrl(site, '/#person'),
    name: PERSON.name,
    alternateName: PERSON.alternateName,
    url: absoluteUrl(site, '/'),
    sameAs: PERSON.sameAs,
  };
}

export function websiteLd(site: string, locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl(site, '/#website'),
    name: SITE_NAME,
    url: absoluteUrl(site, locale === 'fa' ? '/fa' : '/'),
    inLanguage: locale === 'fa' ? 'fa-IR' : 'en',
    publisher: { '@id': absoluteUrl(site, '/#person') },
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
  /** Sources cited in the post: name and address (absolute or a site path). */
  citations?: { name: string; url: string }[];
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
    image: absoluteUrl(i.site, i.image),
    url: absoluteUrl(i.site, i.path),
    mainEntityOfPage: absoluteUrl(i.site, i.path),
    author: { '@id': absoluteUrl(i.site, '/#person') },
    publisher: { '@id': absoluteUrl(i.site, '/#person') },
    // the sources of the "References" box, so search engines see what the post builds on
    ...(i.citations?.length
      ? {
          citation: i.citations.map((c) => ({
            '@type': 'CreativeWork',
            name: c.name,
            url: absoluteUrl(i.site, c.url),
          })),
        }
      : {}),
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
      item: absoluteUrl(site, it.path),
    })),
  };
}

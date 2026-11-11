export type Locale = 'en' | 'fa';
export const LOCALES: Locale[] = ['en', 'fa'];

export function localeFromPath(pathname: string): Locale {
  return pathname === '/fa' || pathname.startsWith('/fa/') ? 'fa' : 'en';
}

/** Prefixes a site path with the locale ('/' → '/fa' for Persian; English is at the root). */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') return clean;
  return clean === '/' ? '/fa' : `/fa${clean}`;
}

/** Strips a '/fa' prefix: '/fa/blog/x' → '/blog/x', '/fa' → '/'. */
export function stripLocale(pathname: string): string {
  if (pathname === '/fa') return '/';
  return pathname.startsWith('/fa/') ? pathname.slice(3) : pathname;
}

/** The same page in another language. */
export function switchPath(pathname: string, to: Locale): string {
  return localePath(to, stripLocale(pathname));
}

export const dirOf = (locale: Locale): 'ltr' | 'rtl' => (locale === 'fa' ? 'rtl' : 'ltr');
export const LANG_NAMES: Record<Locale, { native: string; short: string }> = {
  en: { native: 'English', short: 'EN' },
  fa: { native: 'فارسی', short: 'FA' },
};

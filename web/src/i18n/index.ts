import type { Lang } from '../lib/schemas';

export type Locale = Lang;
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

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const faDigits = (s: string | number): string =>
  String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)] as string);

/** English: Gregorian ("2 Nov 2026"). Persian: Jalali with Persian digits ("۱۱ آبان ۱۴۰۵"). */
export function formatDate(iso: string, locale: Locale, long = false): string {
  const d = new Date(
    iso.includes('T') || iso.includes(' ') ? iso.replace(' ', 'T') : `${iso}T12:00:00Z`,
  );
  if (Number.isNaN(d.getTime())) return '';
  if (locale === 'fa') {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: long ? 'long' : 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
}

const en = {
  siteName: 'zouerami',
  skip: 'Skip to content',
  nav: { home: 'Home', blog: 'Blog', work: 'Work', about: 'About' },
  search: 'Search',
  toggleTheme: 'Toggle theme',
  switchLang: 'فارسی',
  switchLangLabel: 'Read this page in Persian',
  home: {
    title: 'Amir Zouerami — developer, writer, tinkerer',
    description:
      'Amir Zouerami: developer, writer and tinkerer. Notes on the web, design and Persian typography.',
    available: 'Available for work',
    roles: 'Developer / Writer / Tinkerer',
    currently: 'Currently',
    currentlyText: 'Rebuilding this site, in public.',
    latestNote: 'Latest note',
    time: 'Time',
    scroll: 'Scroll',
    latestWriting: 'Latest writing',
    allPosts: 'All posts',
    selectedWork: 'Selected work',
    allProjects: 'All projects',
    newsletter: 'New posts, by email',
    words: 'Words,',
    occasionally: 'occasionally.',
    emailPlaceholder: 'you@email.com',
    subscribe: 'Subscribe',
    marquee: ['Design', 'Engineering', 'Writing', 'Open source', 'Astro', 'Typography'],
    unavailable: 'The blog is temporarily unavailable. Please try again in a minute.',
  },
  blog: {
    title: 'Writing',
    description: 'Notes on the web, design, DevOps and Persian typography.',
    crumb: 'Index / Writing',
    searchPlaceholder: 'Search posts…',
    all: 'All',
    legend:
      'EN / FA badges show which languages each post is written in. Crossed out = not written yet.',
    empty: 'No signal. Try another query.',
  },
  post: {
    published: 'Published',
    reading: 'Reading time',
    views: 'Views',
    language: 'Language',
    min: 'min',
    onThisPage: 'On this page',
    previous: 'Previous',
    next: 'Next',
    notWritten: 'not written yet',
    onlyIn: (l: string) => `This post is only available in ${l}.`,
    preview: 'Draft preview: not public.',
    like: '♥ Like',
    save: '+ Save',
    share: '↗ Share',
    copied: 'Link copied',
    comments: 'Comments',
  },
  work: {
    title: 'Selected work',
    description: 'Projects, tools and open-source work by Amir Zouerami.',
    crumb: 'Index / Work',
    heading: 'Selected',
    headingEm: 'work',
    all: 'All',
    stack: 'Stack',
    back: '← Back',
    category: 'Category',
    year: 'Year',
    links: 'Links',
    live: 'Live ↗',
    repo: 'GitHub ↗',
    nextProject: 'Next project',
    notTranslated: 'This project page is only available in English.',
  },
  about: {
    title: 'About',
    description: 'About Amir Zouerami: timeline, tools and what I am up to now.',
    crumb: 'Index / About',
    statement:
      'I make calm, fast things for the web, and *write* down what I learn so future-me can skip the pain.',
    timeline: 'Timeline',
    uses: 'Uses',
    now: 'Now',
    nowText: 'Rebuilding this site.',
    nowEm: 'Reading about type.',
    resume: 'Résumé',
    hello: 'Say hello',
  },
  notFound: {
    title: '404 — zouerami',
    missing: 'zsh: no such file or directory',
    try: 'try:',
    home: 'Home',
  },
  palette: {
    placeholder: 'Type a command or search…',
    navigate: '↑↓ navigate',
    open: '↵ open',
    close: 'esc close',
    unavailable: 'Search unavailable',
    command: 'Command',
    page: 'page',
    action: 'action',
    post: 'post',
  },
  footer: {
    hello: 'Say',
    helloEm: 'hello',
    top: 'Back to top ↑',
    rights: '© Amir Zouerami',
    local: 'Local',
  },
  langHint: { text: 'Read this site in Persian?', go: 'فارسی', dismiss: 'Dismiss' },
};

type Dict = typeof en;

const fa: Dict = {
  siteName: 'zouerami',
  skip: 'پرش به محتوا',
  nav: { home: 'خانه', blog: 'وبلاگ', work: 'نمونه‌کار', about: 'درباره' },
  search: 'جستجو',
  toggleTheme: 'تغییر پوسته',
  switchLang: 'English',
  switchLangLabel: 'خواندن این صفحه به انگلیسی',
  home: {
    title: 'امیر زوارمی — توسعه‌دهنده و نویسنده',
    description:
      'امیر زوارمی، توسعه‌دهنده و نویسنده. یادداشت‌هایی درباره وب، طراحی و تایپوگرافی فارسی.',
    available: 'آماده همکاری',
    roles: 'توسعه‌دهنده / نویسنده / دستی‌به‌کار',
    currently: 'این روزها',
    currentlyText: 'بازسازی همین سایت، در ملأ عام.',
    latestNote: 'تازه‌ترین یادداشت',
    time: 'زمان',
    scroll: 'اسکرول',
    latestWriting: 'تازه‌ترین نوشته‌ها',
    allPosts: 'همه نوشته‌ها',
    selectedWork: 'نمونه‌کارهای منتخب',
    allProjects: 'همه پروژه‌ها',
    newsletter: 'نوشته‌های تازه، با ایمیل',
    words: 'کلمه‌ها،',
    occasionally: 'گاهی.',
    emailPlaceholder: 'you@email.com',
    subscribe: 'عضویت',
    marquee: ['طراحی', 'مهندسی', 'نوشتن', 'متن‌باز', 'Astro', 'تایپوگرافی'],
    unavailable: 'وبلاگ موقتاً در دسترس نیست. لطفاً یک دقیقه دیگر دوباره امتحان کنید.',
  },
  blog: {
    title: 'نوشته‌ها',
    description: 'یادداشت‌هایی درباره وب، طراحی، دواپس و تایپوگرافی فارسی.',
    crumb: 'فهرست / نوشته‌ها',
    searchPlaceholder: 'جستجوی نوشته‌ها…',
    all: 'همه',
    legend: 'نشان EN / FA زبان‌های هر نوشته را نشان می‌دهد. خط‌خورده یعنی هنوز نوشته نشده.',
    empty: 'چیزی پیدا نشد. عبارت دیگری امتحان کنید.',
  },
  post: {
    published: 'انتشار',
    reading: 'زمان مطالعه',
    views: 'بازدید',
    language: 'زبان',
    min: 'دقیقه',
    onThisPage: 'در این صفحه',
    previous: 'قبلی',
    next: 'بعدی',
    notWritten: 'هنوز نوشته نشده',
    onlyIn: (l: string) => `این نوشته فقط به ${l} موجود است.`,
    preview: 'پیش‌نمایش پیش‌نویس: عمومی نیست.',
    like: '♥ پسندیدن',
    save: '+ ذخیره',
    share: '↗ اشتراک',
    copied: 'پیوند کپی شد',
    comments: 'دیدگاه‌ها',
  },
  work: {
    title: 'نمونه‌کارهای منتخب',
    description: 'پروژه‌ها، ابزارها و کارهای متن‌باز امیر زوارمی.',
    crumb: 'فهرست / نمونه‌کار',
    heading: 'نمونه‌کارهای',
    headingEm: 'منتخب',
    all: 'همه',
    stack: 'فناوری‌ها',
    back: 'بازگشت →',
    category: 'دسته',
    year: 'سال',
    links: 'پیوندها',
    live: 'نسخه زنده ↗',
    repo: 'گیت‌هاب ↗',
    nextProject: 'پروژه بعدی',
    notTranslated: 'این صفحه پروژه فقط به انگلیسی موجود است.',
  },
  about: {
    title: 'درباره',
    description: 'درباره امیر زوارمی: مسیر کاری، ابزارها و کارهای این روزها.',
    crumb: 'فهرست / درباره',
    statement:
      'من چیزهای آرام و سریع برای وب می‌سازم و آنچه یاد می‌گیرم را *می‌نویسم* تا خودِ آینده‌ام از دردسر در امان بماند.',
    timeline: 'مسیر',
    uses: 'ابزارها',
    now: 'اکنون',
    nowText: 'بازسازی همین سایت.',
    nowEm: 'خواندن درباره حروف.',
    resume: 'رزومه',
    hello: 'سلام بدهید',
  },
  notFound: {
    title: '۴۰۴ — zouerami',
    missing: 'zsh: no such file or directory',
    try: 'try:',
    home: 'خانه',
  },
  palette: {
    placeholder: 'دستور یا جستجو…',
    navigate: '↑↓ حرکت',
    open: '↵ باز کردن',
    close: 'esc بستن',
    unavailable: 'جستجو در دسترس نیست',
    command: 'دستور',
    page: 'صفحه',
    action: 'عمل',
    post: 'نوشته',
  },
  footer: {
    hello: 'بگویید',
    helloEm: 'سلام',
    top: 'بازگشت به بالا ↑',
    rights: '© امیر زوارمی',
    local: 'ساعت محلی',
  },
  langHint: { text: 'این سایت را به فارسی بخوانید؟', go: 'فارسی', dismiss: 'بستن' },
};

export const ui: Record<Locale, Dict> = { en, fa };
export const t = (locale: Locale): Dict => ui[locale];
export const dirOf = (locale: Locale): 'ltr' | 'rtl' => (locale === 'fa' ? 'rtl' : 'ltr');
export const LANG_NAMES: Record<Locale, { native: string; short: string }> = {
  en: { native: 'English', short: 'EN' },
  fa: { native: 'فارسی', short: 'FA' },
};

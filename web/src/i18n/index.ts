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
  auth: {
    signIn: 'Sign in',
    account: 'Account',
    loginTitle: 'Sign in',
    registerTitle: 'Create account',
    forgotTitle: 'Forgot password',
    resetTitle: 'New password',
    verifyTitle: 'Verify email',
    accountTitle: 'Your account',
    email: 'Email',
    password: 'Password',
    name: 'Display name',
    newPassword: 'New password (min 10 characters)',
    passwordHint: 'At least 10 characters.',
    signUp: 'Create account',
    send: 'Send link',
    save: 'Save password',
    noAccount: 'No account yet?',
    haveAccount: 'Already have an account?',
    forgot: 'Forgot your password?',
    or: 'or',
    continueWith: 'Continue with',
    checkInbox: 'Check your inbox: we sent a verification link. It may take a minute.',
    verifying: 'Verifying…',
    verified: 'Email verified. You can sign in now.',
    verifyFail: 'This link is invalid or has expired.',
    resetSent: 'If that address has an account, a reset link is on its way.',
    resetDone: 'Password updated. You can sign in now.',
    badCredentials: 'Wrong email or password.',
    unverified: 'Please verify your email first.',
    resend: 'Resend verification email',
    resent: 'If that address needs verification, a new link is on its way.',
    generic: 'Something went wrong. Please try again.',
    oauthError: 'Could not sign in with that provider.',
    signOut: 'Sign out',
    bookmarks: 'Saved posts',
    noBookmarks: 'Nothing saved yet. Use “+ Save” on a post.',
    danger: 'Delete account',
    deleteHelp:
      'Permanently deletes your account, comments, likes and saved posts. This cannot be undone.',
    deletePassword: 'Confirm with your password',
    deleteBtn: 'Delete my account',
    deleted: 'Your account was deleted.',
    mustSignIn: 'Sign in to continue.',
    privacyLink: 'Privacy',
  },
  comments: {
    title: 'Comments',
    placeholder: 'Leave a comment…',
    post: 'Post comment',
    reply: 'Reply',
    cancel: 'Cancel',
    delete: 'Delete',
    pending: 'Held for review',
    pendingNote: 'Your first comment is reviewed before it appears. Thanks for your patience.',
    signInToComment: 'Sign in to comment',
    verifyToComment: 'Verify your email to comment.',
    none: 'No comments yet.',
    failed: 'Could not post your comment.',
    loadFailed: 'Comments are temporarily unavailable.',
    ago: 'ago',
  },
  subscribe: {
    ok: 'Almost done: check your inbox to confirm.',
    invalid: 'Please enter a valid email address.',
    failed: 'Could not subscribe right now. Please try again.',
    confirmTitle: 'Confirm subscription',
    confirmed: 'Subscription confirmed. Thank you!',
    confirmFail: 'This link is invalid or already used.',
    unsubTitle: 'Unsubscribe',
    unsubDone: 'You have been unsubscribed.',
    unsubFail: 'This link is invalid or already used.',
  },
  privacy: {
    title: 'Privacy',
    description: 'What this site collects and why.',
    body: [
      [
        'What I collect',
        'Only what is needed to run the site: if you create an account, your email, display name and password hash; the comments, likes and saved posts you make; and, if you subscribe, your email address.',
      ],
      [
        'Analytics and tracking',
        'There are no analytics scripts and no advertising trackers. Post view counts are a single anonymous counter: the server stores a number, not who or from where. Your browser remembers locally (on your device only) your theme, language choice and which posts you have already counted today.',
      ],
      [
        'Cookies',
        'Signing in sets two strictly necessary cookies (a short-lived session and a refresh token). There are no cookies for tracking.',
      ],
      [
        'Third parties',
        'Cloudflare Turnstile may check that a sign-up or comment comes from a person. Email is sent through an email delivery provider. If you sign in with GitHub or Google, they tell me your name and email address.',
      ],
      [
        'Your control',
        'You can delete your account at any time from the account page: your account, comments, likes and saved posts are removed. You can unsubscribe from the newsletter with the link in every email.',
      ],
      ['Contact', 'hello@zouerami.dev'],
    ],
  },
};

type Widen<T> = T extends string
  ? string
  : T extends (infer U)[]
    ? Widen<U>[]
    : T extends (...a: infer A) => infer R
      ? (...a: A) => R
      : { [K in keyof T]: Widen<T[K]> };
type Dict = Widen<typeof en>;

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
  auth: {
    signIn: 'ورود',
    account: 'حساب',
    loginTitle: 'ورود',
    registerTitle: 'ساخت حساب',
    forgotTitle: 'فراموشی رمز عبور',
    resetTitle: 'رمز عبور تازه',
    verifyTitle: 'تأیید ایمیل',
    accountTitle: 'حساب شما',
    email: 'ایمیل',
    password: 'رمز عبور',
    name: 'نام نمایشی',
    newPassword: 'رمز عبور تازه (دست‌کم ۱۰ نویسه)',
    passwordHint: 'دست‌کم ۱۰ نویسه.',
    signUp: 'ساخت حساب',
    send: 'ارسال پیوند',
    save: 'ذخیره رمز عبور',
    noAccount: 'حساب ندارید؟',
    haveAccount: 'قبلاً حساب ساخته‌اید؟',
    forgot: 'رمز عبور را فراموش کرده‌اید؟',
    or: 'یا',
    continueWith: 'ادامه با',
    checkInbox: 'صندوق ایمیلتان را ببینید: پیوند تأیید فرستاده شد. ممکن است یک دقیقه طول بکشد.',
    verifying: 'در حال تأیید…',
    verified: 'ایمیل تأیید شد. اکنون می‌توانید وارد شوید.',
    verifyFail: 'این پیوند نامعتبر است یا منقضی شده.',
    resetSent: 'اگر این نشانی حسابی دارد، پیوند بازنشانی در راه است.',
    resetDone: 'رمز عبور تغییر کرد. اکنون می‌توانید وارد شوید.',
    badCredentials: 'ایمیل یا رمز عبور نادرست است.',
    unverified: 'ابتدا ایمیلتان را تأیید کنید.',
    resend: 'ارسال دوباره ایمیل تأیید',
    resent: 'اگر این نشانی نیاز به تأیید دارد، پیوند تازه‌ای در راه است.',
    generic: 'مشکلی پیش آمد. لطفاً دوباره امتحان کنید.',
    oauthError: 'ورود با این سرویس ممکن نشد.',
    signOut: 'خروج',
    bookmarks: 'نوشته‌های ذخیره‌شده',
    noBookmarks: 'هنوز چیزی ذخیره نکرده‌اید. در هر نوشته «+ ذخیره» را بزنید.',
    danger: 'حذف حساب',
    deleteHelp:
      'حساب، دیدگاه‌ها، پسندها و نوشته‌های ذخیره‌شده‌تان برای همیشه حذف می‌شود و بازگشتی ندارد.',
    deletePassword: 'با رمز عبور تأیید کنید',
    deleteBtn: 'حذف حساب من',
    deleted: 'حساب شما حذف شد.',
    mustSignIn: 'برای ادامه وارد شوید.',
    privacyLink: 'حریم خصوصی',
  },
  comments: {
    title: 'دیدگاه‌ها',
    placeholder: 'دیدگاهتان را بنویسید…',
    post: 'ارسال دیدگاه',
    reply: 'پاسخ',
    cancel: 'انصراف',
    delete: 'حذف',
    pending: 'در انتظار بررسی',
    pendingNote: 'نخستین دیدگاه شما پیش از نمایش بررسی می‌شود. سپاس از شکیبایی‌تان.',
    signInToComment: 'برای نوشتن دیدگاه وارد شوید',
    verifyToComment: 'برای نوشتن دیدگاه ایمیلتان را تأیید کنید.',
    none: 'هنوز دیدگاهی نیست.',
    failed: 'ارسال دیدگاه ممکن نشد.',
    loadFailed: 'دیدگاه‌ها موقتاً در دسترس نیستند.',
    ago: 'پیش',
  },
  subscribe: {
    ok: 'تقریباً تمام شد: برای تأیید صندوق ایمیلتان را ببینید.',
    invalid: 'یک نشانی ایمیل معتبر وارد کنید.',
    failed: 'اکنون عضویت ممکن نیست. لطفاً دوباره امتحان کنید.',
    confirmTitle: 'تأیید عضویت',
    confirmed: 'عضویت تأیید شد. سپاسگزارم!',
    confirmFail: 'این پیوند نامعتبر است یا قبلاً استفاده شده.',
    unsubTitle: 'لغو عضویت',
    unsubDone: 'عضویت شما لغو شد.',
    unsubFail: 'این پیوند نامعتبر است یا قبلاً استفاده شده.',
  },
  privacy: {
    title: 'حریم خصوصی',
    description: 'این سایت چه چیزهایی را جمع می‌کند و چرا.',
    body: [
      [
        'چه چیزی جمع می‌کنم',
        'فقط آنچه برای اجرای سایت لازم است: اگر حساب بسازید، ایمیل، نام نمایشی و هش رمز عبورتان؛ دیدگاه‌ها، پسندها و نوشته‌های ذخیره‌شده؛ و اگر عضو خبرنامه شوید، نشانی ایمیلتان.',
      ],
      [
        'آمار و ردیابی',
        'هیچ اسکریپت آماری یا ردیاب تبلیغاتی در کار نیست. شمار بازدید فقط یک عدد ناشناس است: سرور یک عدد نگه می‌دارد، نه اینکه چه کسی یا از کجا. مرورگرتان به‌طور محلی (فقط روی دستگاه خودتان) پوسته، زبان و اینکه امروز کدام نوشته‌ها را شمرده‌ام به یاد می‌سپارد.',
      ],
      [
        'کوکی‌ها',
        'ورود دو کوکی ضروری می‌گذارد (نشست کوتاه‌مدت و توکن نوسازی). هیچ کوکی ردیابی وجود ندارد.',
      ],
      [
        'اشخاص ثالث',
        'Cloudflare Turnstile ممکن است بررسی کند که ثبت‌نام یا دیدگاه از یک انسان است. ایمیل‌ها از طریق یک سرویس ارسال ایمیل فرستاده می‌شوند. اگر با GitHub یا Google وارد شوید، نام و ایمیلتان را به من می‌دهند.',
      ],
      [
        'اختیار با شماست',
        'هر زمان می‌توانید از صفحه حساب، حسابتان را حذف کنید: حساب، دیدگاه‌ها، پسندها و نوشته‌های ذخیره‌شده پاک می‌شوند. با پیوند هر ایمیل می‌توانید عضویت در خبرنامه را لغو کنید.',
      ],
      ['تماس', 'hello@zouerami.dev'],
    ],
  },
};

export const ui: Record<Locale, Dict> = { en, fa };
export const t = (locale: Locale): Dict => ui[locale];
export const dirOf = (locale: Locale): 'ltr' | 'rtl' => (locale === 'fa' ? 'rtl' : 'ltr');
export const LANG_NAMES: Record<Locale, { native: string; short: string }> = {
  en: { native: 'English', short: 'EN' },
  fa: { native: 'فارسی', short: 'FA' },
};

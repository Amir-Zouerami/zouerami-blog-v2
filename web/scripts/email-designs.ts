/**
 * Generates the candidate email designs (docs/email-designs/*) and sends them to Mailpit for review.
 *   bun scripts/email-designs.ts            # write files + send to Mailpit at :8025
 * Templates use {{URL}} for the action link; real mail would substitute PocketBase's {TOKEN} URL.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Lang = 'en' | 'fa';
type Kind = 'verify' | 'reset' | 'subscribe';

const COPY: Record<
  Kind,
  Record<
    Lang,
    {
      subject: string;
      pre: string;
      title: string;
      titleEm: string;
      body: string;
      button: string;
      note: string;
    }
  >
> = {
  verify: {
    en: {
      subject: 'Verify your email for zouerami.dev',
      pre: 'One click to finish creating your account.',
      title: 'Confirm your',
      titleEm: 'email.',
      body: 'Thanks for signing up. Confirm your address to finish creating your account and join the conversation.',
      button: 'Verify email',
      note: 'If you did not sign up, you can safely ignore this message.',
    },
    fa: {
      subject: 'تأیید ایمیل شما در zouerami.dev',
      pre: 'با یک کلیک ساخت حساب را کامل کنید.',
      title: 'ایمیلتان را',
      titleEm: 'تأیید کنید.',
      body: 'از ثبت‌نام شما سپاسگزارم. برای تکمیل ساخت حساب و شرکت در گفتگوها، نشانی ایمیلتان را تأیید کنید.',
      button: 'تأیید ایمیل',
      note: 'اگر شما ثبت‌نام نکرده‌اید، این پیام را نادیده بگیرید.',
    },
  },
  reset: {
    en: {
      subject: 'Reset your zouerami.dev password',
      pre: 'Choose a new password. The link expires soon.',
      title: 'Reset your',
      titleEm: 'password.',
      body: 'Someone (hopefully you) asked to reset the password for your account. Use the button below to choose a new one.',
      button: 'Choose a new password',
      note: 'If you did not ask for this, nothing changes. Your password stays the same.',
    },
    fa: {
      subject: 'بازنشانی رمز عبور zouerami.dev',
      pre: 'رمز عبور تازه‌ای انتخاب کنید. پیوند به‌زودی منقضی می‌شود.',
      title: 'رمز عبورتان را',
      titleEm: 'بازنشانی کنید.',
      body: 'کسی (امیدوارم خودتان) درخواست بازنشانی رمز عبور حسابتان را داده است. با دکمه زیر رمز تازه‌ای انتخاب کنید.',
      button: 'انتخاب رمز تازه',
      note: 'اگر این درخواست از شما نبود، هیچ چیز تغییر نمی‌کند و رمز شما همان می‌ماند.',
    },
  },
  subscribe: {
    en: {
      subject: 'Confirm your subscription',
      pre: 'One tap and new posts will find you.',
      title: 'Words,',
      titleEm: 'occasionally.',
      body: 'You asked to get new posts by email. Confirm your address and I will write when there is something worth reading. No spam, ever.',
      button: 'Confirm subscription',
      note: 'If this was not you, ignore this email and nothing will be sent.',
    },
    fa: {
      subject: 'تأیید عضویت در خبرنامه',
      pre: 'با یک ضربه، نوشته‌های تازه به دستتان می‌رسد.',
      title: 'کلمه‌ها،',
      titleEm: 'گاهی.',
      body: 'شما خواسته‌اید نوشته‌های تازه را با ایمیل دریافت کنید. نشانی‌تان را تأیید کنید تا وقتی چیز خواندنی‌ای هست برایتان بنویسم. بدون هرزنامه.',
      button: 'تأیید عضویت',
      note: 'اگر این درخواست از شما نبود، این ایمیل را نادیده بگیرید؛ چیزی ارسال نخواهد شد.',
    },
  },
};

interface Palette {
  page: string;
  card: string;
  fg: string;
  muted: string;
  line: string;
  acc: string;
  onAcc: string;
  accText: string;
  head: string;
  serif: string;
  mono: string;
}

const FONT = {
  head: "'Helvetica Neue',Helvetica,Arial,sans-serif",
  serif: "Georgia,'Times New Roman',serif",
  mono: "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace",
  fa: "Tahoma,'Segoe UI',Arial,sans-serif",
};

/** Shared bulletproof shell: tables + inline styles only (Gmail/Outlook/Apple Mail safe). */
function shell(
  p: Palette,
  lang: Lang,
  c: (typeof COPY)[Kind][Lang],
  inner: string,
  opts: { footerBg?: string } = {},
): string {
  const rtl = lang === 'fa';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const body = rtl ? FONT.fa : FONT.head;
  return `<!doctype html>
<html lang="${lang}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${c.subject}</title>
<style>
  body{margin:0;padding:0;background:${p.page}} a{color:${p.accText}}
  @media (max-width:620px){ .wrap{width:100%!important} .pad{padding-left:24px!important;padding-right:24px!important} .h1{font-size:40px!important;line-height:44px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:${p.page};font-family:${body};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${p.page}">${c.pre}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.page}" style="background:${p.page}"><tr><td align="center" style="padding:32px 12px">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;text-align:${align}" dir="${dir}">
    ${inner}
    <tr><td class="pad" style="padding:22px 40px 0;font:12px/18px ${FONT.mono};color:${p.muted};text-align:${align};${opts.footerBg ? '' : ''}">
      zouerami.dev &nbsp;·&nbsp; Amir Zouerami<br>
      <a href="{{SITE}}" style="color:${p.muted}">{{SITE}}</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function button(p: Palette, label: string, radius: number, rtl: boolean): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="${rtl ? 'rtl' : 'ltr'}"><tr>
    <td bgcolor="${p.acc}" style="background:${p.acc};border-radius:${radius}px">
      <a href="{{URL}}" style="display:inline-block;padding:16px 30px;font:700 16px/20px ${rtl ? FONT.fa : FONT.head};color:${p.onAcc};text-decoration:none;border-radius:${radius}px">${label}</a>
    </td></tr></table>`;
}

const linkFallback = (p: Palette, lang: Lang) =>
  `<p style="margin:26px 0 0;font:12px/18px ${FONT.mono};color:${p.muted};word-break:break-all">${lang === 'fa' ? 'اگر دکمه کار نکرد، این نشانی را در مرورگر باز کنید:' : 'Button not working? Paste this link into your browser:'}<br><a href="{{URL}}" style="color:${p.muted}">{{URL}}</a></p>`;

/** A — "Signal Dark": the site's own dark theme: black, lime, mono labels, big type. */
function designA(lang: Lang, c: (typeof COPY)[Kind][Lang]): string {
  const p: Palette = {
    page: '#0a0a0b',
    card: '#111113',
    fg: '#ecece6',
    muted: '#85857f',
    line: '#232326',
    acc: '#d4ff3a',
    onAcc: '#0a0a0b',
    accText: '#d4ff3a',
    head: FONT.head,
    serif: FONT.serif,
    mono: FONT.mono,
  };
  const rtl = lang === 'fa';
  const a = rtl ? 'right' : 'left';
  const f = rtl ? FONT.fa : FONT.head;
  return shell(
    p,
    lang,
    c,
    `
    <tr><td class="pad" style="padding:0 40px 28px;border-bottom:1px solid ${p.line};text-align:${a}">
      <span style="font:800 22px/24px ${FONT.head};letter-spacing:-1px;color:${p.fg}">zouerami</span><span style="font:11px ${FONT.mono};color:${p.acc};vertical-align:top"> &reg;</span>
    </td></tr>
    <tr><td class="pad" style="padding:44px 40px 8px;text-align:${a}">
      <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${p.acc}"></span>
      <span style="font:500 12px/16px ${FONT.mono};letter-spacing:1px;text-transform:uppercase;color:${p.muted}">&nbsp;zouerami.dev</span>
    </td></tr>
    <tr><td class="pad" style="padding:8px 40px 0;text-align:${a}">
      <h1 class="h1" style="margin:0;font:${rtl ? 800 : 700} 54px/56px ${f};letter-spacing:${rtl ? 0 : -2}px;color:${p.fg}">${c.title}<br><span style="font:italic 400 54px/56px ${rtl ? FONT.fa : FONT.serif};color:${p.acc};letter-spacing:0">${c.titleEm}</span></h1>
    </td></tr>
    <tr><td class="pad" style="padding:24px 40px 0;text-align:${a};font:17px/27px ${f};color:#cfcfc8">${c.body}</td></tr>
    <tr><td class="pad" style="padding:34px 40px 0;text-align:${a}">${button(p, c.button, 999, rtl)}${linkFallback(p, lang)}</td></tr>
    <tr><td class="pad" style="padding:36px 40px 0;text-align:${a}"><div style="border-top:1px solid ${p.line};padding-top:18px;font:14px/22px ${f};color:${p.muted}">${c.note}</div></td></tr>`,
  );
}

/** B — "Signal Paper": the light theme, editorial: warm paper, ink-blue, serif italic. */
function designB(lang: Lang, c: (typeof COPY)[Kind][Lang]): string {
  const p: Palette = {
    page: '#f1f0ea',
    card: '#ffffff',
    fg: '#0d0d0e',
    muted: '#6d6d66',
    line: '#d6d5cb',
    acc: '#2a3bff',
    onAcc: '#ffffff',
    accText: '#2a3bff',
    head: FONT.head,
    serif: FONT.serif,
    mono: FONT.mono,
  };
  const rtl = lang === 'fa';
  const a = rtl ? 'right' : 'left';
  const f = rtl ? FONT.fa : FONT.head;
  return shell(
    p,
    lang,
    c,
    `
    <tr><td bgcolor="${p.card}" style="background:${p.card};border:1px solid ${p.line};border-radius:18px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td height="6" bgcolor="${p.acc}" style="background:${p.acc};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td class="pad" style="padding:30px 40px 0;text-align:${a};font:italic 400 26px/28px ${FONT.serif};color:${p.fg}">zouerami<span style="font:11px ${FONT.mono};color:${p.acc};vertical-align:top">&reg;</span></td></tr>
        <tr><td class="pad" style="padding:34px 40px 0;text-align:${a}">
          <h1 class="h1" style="margin:0;font:${rtl ? 800 : 600} 46px/50px ${f};letter-spacing:${rtl ? 0 : -1.5}px;color:${p.fg}">${c.title} <span style="font:italic 400 46px/50px ${rtl ? FONT.fa : FONT.serif};color:${p.acc};letter-spacing:0">${c.titleEm}</span></h1>
        </td></tr>
        <tr><td class="pad" style="padding:20px 40px 0;text-align:${a};font:17px/27px ${f};color:#3a3a38">${c.body}</td></tr>
        <tr><td class="pad" style="padding:30px 40px 0;text-align:${a}">${button(p, c.button, 10, rtl)}${linkFallback(p, lang)}</td></tr>
        <tr><td class="pad" style="padding:30px 40px 34px;text-align:${a}"><div style="border-top:1px solid ${p.line};padding-top:16px;font:14px/22px ${f};color:${p.muted}">${c.note}</div></td></tr>
      </table>
    </td></tr>`,
  );
}

/** C — "Quiet card": most conservative: white card, thin lime rule, plain type. Renders the same everywhere. */
function designC(lang: Lang, c: (typeof COPY)[Kind][Lang]): string {
  const p: Palette = {
    page: '#f4f4f1',
    card: '#ffffff',
    fg: '#17171a',
    muted: '#7a7a73',
    line: '#e6e6e0',
    acc: '#17171a',
    onAcc: '#d4ff3a',
    accText: '#17171a',
    head: FONT.head,
    serif: FONT.serif,
    mono: FONT.mono,
  };
  const rtl = lang === 'fa';
  const a = rtl ? 'right' : 'left';
  const f = rtl ? FONT.fa : FONT.head;
  return shell(
    p,
    lang,
    c,
    `
    <tr><td align="center" style="padding:0 0 18px;font:700 18px/20px ${FONT.head};letter-spacing:-.5px;color:${p.fg}">zouerami<span style="color:#9ccc00">.</span>dev</td></tr>
    <tr><td bgcolor="${p.card}" style="background:${p.card};border:1px solid ${p.line};border-radius:12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td class="pad" style="padding:38px 40px 0;text-align:${a}"><div style="width:44px;height:4px;background:#d4ff3a;border-radius:2px"></div></td></tr>
        <tr><td class="pad" style="padding:22px 40px 0;text-align:${a}"><h1 style="margin:0;font:${rtl ? 800 : 700} 28px/34px ${f};color:${p.fg}">${c.title} ${c.titleEm}</h1></td></tr>
        <tr><td class="pad" style="padding:14px 40px 0;text-align:${a};font:16px/25px ${f};color:#44443f">${c.body}</td></tr>
        <tr><td class="pad" style="padding:28px 40px 0;text-align:${a}">${button(p, c.button, 8, rtl)}${linkFallback(p, lang)}</td></tr>
        <tr><td class="pad" style="padding:28px 40px 34px;text-align:${a};font:13px/20px ${f};color:${p.muted}">${c.note}</td></tr>
      </table>
    </td></tr>`,
  );
}

const DESIGNS = {
  'a-signal-dark': designA,
  'b-signal-paper': designB,
  'c-quiet-card': designC,
} as const;

const out = join(import.meta.dirname, '../../docs/email-designs');
const SAMPLE_URL = 'http://localhost:8088/verify?token=EXAMPLE-TOKEN-0123456789';
const fill = (html: string) =>
  html.replaceAll('{{URL}}', SAMPLE_URL).replaceAll('{{SITE}}', 'https://zouerami.dev');

const kinds = Object.keys(COPY) as Kind[];
for (const [name, design] of Object.entries(DESIGNS)) {
  mkdirSync(join(out, name), { recursive: true });
  for (const kind of kinds) {
    for (const lang of ['en', 'fa'] as Lang[]) {
      writeFileSync(join(out, name, `${kind}.${lang}.html`), design(lang, COPY[kind][lang]));
    }
  }
}
// local gallery
const tiles = Object.keys(DESIGNS)
  .map(
    (n) =>
      `<section><h2>${n}</h2><div class="row">${(['verify.en', 'reset.en', 'subscribe.en', 'verify.fa'] as const).map((f) => `<iframe loading="lazy" src="${n}/${f}.html" title="${n} ${f}"></iframe>`).join('')}</div></section>`,
  )
  .join('');
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><meta charset=utf-8><title>Email designs</title><style>body{font:15px system-ui;margin:24px;background:#ddd}h2{margin:28px 0 8px}.row{display:flex;gap:14px;overflow:auto}iframe{flex:none;width:660px;height:760px;border:1px solid #bbb;background:#fff}</style><h1>Email designs</h1>${tiles}`,
);

// send real messages to Mailpit so they can be judged in a mail client UI
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025';
let sent = 0;
for (const [name, design] of Object.entries(DESIGNS)) {
  for (const [kind, lang] of [
    ['verify', 'en'],
    ['reset', 'en'],
    ['subscribe', 'en'],
    ['verify', 'fa'],
  ] as [Kind, Lang][]) {
    const c = COPY[kind][lang];
    const res = await fetch(`${MAILPIT}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: { Email: 'no-reply@zouerami.dev', Name: 'zouerami' },
        To: [{ Email: 'design-preview@example.com' }],
        Subject: `[${name.slice(0, 1).toUpperCase()}] ${c.subject}${lang === 'fa' ? ' (FA)' : ''}`,
        HTML: fill(design(lang, c)),
      }),
    });
    if (res.ok) sent++;
  }
}
console.log(
  `wrote ${Object.keys(DESIGNS).length * kinds.length * 2} templates to docs/email-designs; sent ${sent} previews to Mailpit`,
);

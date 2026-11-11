/**
 * The site's transactional emails ("Signal Dark" design), English only.
 * Table layout + inline styles only, so Gmail, Outlook and Apple Mail render it the same way.
 * Placeholders: {{URL}} (the action link) and {{SITE}} (public origin) are substituted by the PocketBase hooks.
 */
export type EmailKind = 'verify' | 'reset' | 'subscribe';
export const EMAIL_KINDS: EmailKind[] = ['verify', 'reset', 'subscribe'];

export interface EmailCopy {
  subject: string;
  /** Inbox preview text. */
  preheader: string;
  title: string;
  /** Italic lime word(s) closing the headline. */
  titleEm: string;
  body: string;
  button: string;
  note: string;
}

export const COPY: Record<EmailKind, EmailCopy> = {
  verify: {
    subject: 'Verify your email for zouerami.dev',
    preheader: 'One click to finish creating your account.',
    title: 'Confirm your',
    titleEm: 'email.',
    body: 'Thanks for signing up. Confirm your address to finish creating your account and join the conversation.',
    button: 'Verify email',
    note: 'If you did not sign up, you can safely ignore this message.',
  },
  reset: {
    subject: 'Reset your zouerami.dev password',
    preheader: 'Choose a new password. The link expires soon.',
    title: 'Reset your',
    titleEm: 'password.',
    body: 'Someone (hopefully you) asked to reset the password for your account. Use the button below to choose a new one.',
    button: 'Choose a new password',
    note: 'If you did not ask for this, nothing changes. Your password stays the same.',
  },
  subscribe: {
    subject: 'Confirm your subscription',
    preheader: 'One tap and new posts will find you.',
    title: 'Words,',
    titleEm: 'occasionally.',
    body: 'You asked to get new posts by email. Confirm your address and I will write when there is something worth reading. No spam, ever.',
    button: 'Confirm subscription',
    note: 'If this was not you, ignore this email and nothing will be sent.',
  },
};

const C = {
  page: '#0a0a0b',
  fg: '#ecece6',
  body: '#cfcfc8',
  muted: '#85857f',
  line: '#232326',
  acc: '#d4ff3a',
  onAcc: '#0a0a0b',
};
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );

export function renderEmail(kind: EmailKind): string {
  const c = COPY[kind];
  return `<!doctype html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(c.subject)}</title>
<style>
  html,body{margin:0;padding:0;background:${C.page};height:100%} a{color:${C.acc}}
  @media (max-width:620px){ .wrap{width:100%!important} .pad{padding-left:24px!important;padding-right:24px!important} .h1{font-size:40px!important;line-height:44px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${SANS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${esc(c.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};height:100%"><tr><td align="center" valign="top" style="padding:32px 12px 48px">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;text-align:left">
    <tr><td class="pad" style="padding:0 40px 28px;border-bottom:1px solid ${C.line};text-align:left">
      <span style="font:800 22px/24px ${SANS};letter-spacing:-1px;color:${C.fg}">zouerami</span><span style="font:11px ${MONO};color:${C.acc};vertical-align:top"> &reg;</span>
    </td></tr>
    <tr><td class="pad" style="padding:44px 40px 8px;text-align:left">
      <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${C.acc}"></span>
      <span style="font:500 12px/16px ${MONO};letter-spacing:1px;text-transform:uppercase;color:${C.muted}">&nbsp;zouerami.dev</span>
    </td></tr>
    <tr><td class="pad" style="padding:8px 40px 0;text-align:left">
      <h1 class="h1" style="margin:0;font:700 54px/56px ${SANS};letter-spacing:-2px;color:${C.fg}">${esc(c.title)}<br><span style="font:italic 400 54px/56px ${SERIF};color:${C.acc};letter-spacing:0">${esc(c.titleEm)}</span></h1>
    </td></tr>
    <tr><td class="pad" style="padding:24px 40px 0;text-align:left;font:17px/27px ${SANS};color:${C.body}">${esc(c.body)}</td></tr>
    <tr><td class="pad" style="padding:34px 40px 0;text-align:left">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${C.acc}" style="background:${C.acc};border-radius:999px">
          <a href="{{URL}}" style="display:inline-block;padding:16px 30px;font:700 16px/20px ${SANS};color:${C.onAcc};text-decoration:none;border-radius:999px">${esc(c.button)}</a>
        </td></tr></table>
      <p style="margin:26px 0 0;font:12px/18px ${MONO};color:${C.muted};word-break:break-all">Button not working? Paste this link into your browser:<br><a href="{{URL}}" style="color:${C.muted}">{{URL}}</a></p>
    </td></tr>
    <tr><td class="pad" style="padding:36px 40px 0;text-align:left"><div style="border-top:1px solid ${C.line};padding-top:18px;font:14px/22px ${SANS};color:${C.muted}">${esc(c.note)}</div></td></tr>
    <tr><td class="pad" style="padding:22px 40px 0;font:12px/18px ${MONO};color:${C.muted};text-align:left">
      zouerami.dev &nbsp;·&nbsp; Amir Zouerami<br>
      <a href="{{SITE}}" style="color:${C.muted}">{{SITE}}</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>
`;
}

/** Plain-text twin for clients (and spam filters) that want one. */
export function renderText(kind: EmailKind): string {
  const c = COPY[kind];
  return `${c.title} ${c.titleEm}\n\n${c.body}\n\n${c.button}: {{URL}}\n\n${c.note}\n\nzouerami.dev · Amir Zouerami\n{{SITE}}\n`;
}

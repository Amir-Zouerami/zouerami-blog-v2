import { busy, lockFields } from '../lib/busy';
import { api, describe } from '../lib/client-api';
import { guardToken } from '../lib/guard-client';

/** Progressive enhancement for the account forms: posts JSON, shows messages, never leaves the page on error. */
const w = window as unknown as { __authForms?: boolean };

type Msgs = Record<string, string>;

function say(form: HTMLFormElement, text: string, kind: 'ok' | 'err' = 'err') {
  const el = form.querySelector<HTMLElement>('[data-msg]');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

async function submit(form: HTMLFormElement) {
  const msgs = JSON.parse(form.dataset.msgs ?? '{}') as Msgs;
  const next = new URLSearchParams(location.search).get('next') ?? '';
  const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
  const token = new URLSearchParams(location.search).get('token');
  if (token && form.dataset.useToken !== undefined) data.token = token;
  const btn = form.querySelector<HTMLButtonElement>('button[type=submit]');
  if (btn?.dataset.busy !== undefined) return;
  const done = busy(btn);
  const unlock = lockFields(form);
  say(form, '', 'ok');
  let leaving = false; // a page change follows: keep spinning until it happens
  try {
    if (form.dataset.guard !== undefined) {
      const guard = await guardToken().catch(() => null);
      if (!guard) {
        say(form, msgs.generic ?? '');
        return;
      }
      data.guard = guard;
    }
    const res = await api(form.dataset.endpoint ?? '', {
      method: form.dataset.method ?? 'POST',
      json: data,
    });
    if (res.ok) {
      const action = form.dataset.onOk;
      if (action === 'redirect') {
        const safe =
          next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
            ? next
            : form.dataset.home || '/';
        leaving = true;
        location.assign(safe);
        return;
      }
      if (action === 'home') {
        leaving = true;
        location.assign(form.dataset.home || '/');
        return;
      }
      say(form, msgs.ok ?? res.message, 'ok');
      if (form.dataset.reset !== undefined) form.reset();
    } else if (res.code === 'unverified') {
      say(form, msgs.unverified ?? res.message);
      form.querySelector<HTMLElement>('[data-resend]')?.removeAttribute('hidden');
    } else if (res.code === 'invalid_credentials') {
      say(form, msgs.bad ?? res.message);
    } else {
      say(
        form,
        res.status >= 500 || !res.message ? describe(res, msgs.generic ?? '') : res.message,
      );
    }
  } finally {
    if (!leaving) {
      await done();
      unlock();
    }
  }
}

if (!w.__authForms) {
  w.__authForms = true;
  document.addEventListener('submit', (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>('form[data-endpoint]');
    if (!form) return;
    e.preventDefault();
    void submit(form);
  });
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const resend = t.closest<HTMLElement>('[data-resend]');
    if (resend) {
      const form = resend.closest('form') as HTMLFormElement | null;
      const email = (form?.querySelector('input[name=email]') as HTMLInputElement | null)?.value;
      if (form && email && resend.dataset.busy === undefined) {
        const msgs = JSON.parse(form.dataset.msgs ?? '{}') as Msgs;
        const done = busy(resend);
        void api('/api/auth/resend', { json: { email } }).then(async (res) => {
          await done();
          say(
            form,
            res.ok ? (msgs.resent ?? res.message) : describe(res, msgs.generic ?? ''),
            res.ok ? 'ok' : 'err',
          );
        });
      }
    }
    const out = t.closest<HTMLElement>('[data-signout]');
    if (out && out.dataset.busy === undefined) {
      busy(out);
      void api('/api/auth/logout', { method: 'POST', body: '{}' }).then(() =>
        location.assign(out.dataset.home || '/'),
      );
    }
    // GitHub / Google: a full page load to another site, which can take a while
    const sso = t.closest<HTMLElement>('.oauth a');
    if (sso && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      const done = busy(sso);
      // coming back with the Back button restores the page as it was left: stop spinning
      addEventListener('pageshow', () => void done(), { once: true });
    }
  });
}

/** One-shot token pages: /verify, /subscribe/confirm, /unsubscribe. */
export function runTokenPage() {
  const root = document.querySelector<HTMLElement>('[data-token-page]');
  if (!root) return;
  const token = new URLSearchParams(location.search).get('token');
  const out = root.querySelector<HTMLElement>('[data-result]');
  if (!out) return;
  const set = (text: string, kind: 'ok' | 'err') => {
    root.querySelector('.ui-spin')?.remove();
    out.textContent = text;
    out.dataset.kind = kind;
  };
  if (!token) return set(root.dataset.fail ?? '', 'err');
  void api(root.dataset.endpoint ?? '', { json: { token } }).then((res) =>
    set(res.ok ? (root.dataset.ok ?? '') : (root.dataset.fail ?? ''), res.ok ? 'ok' : 'err'),
  );
}

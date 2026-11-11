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
  if (data['cf-turnstile-response']) {
    data.turnstile = data['cf-turnstile-response'];
    delete data['cf-turnstile-response'];
  }
  const token = new URLSearchParams(location.search).get('token');
  if (token && form.dataset.useToken !== undefined) data.token = token;
  const btn = form.querySelector<HTMLButtonElement>('button[type=submit]');
  if (btn) btn.disabled = true;
  say(form, '', 'ok');
  try {
    const res = await fetch(form.dataset.endpoint ?? '', {
      method: form.dataset.method ?? 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (res.ok || res.status === 204) {
      const action = form.dataset.onOk;
      if (action === 'redirect') {
        const safe =
          next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
            ? next
            : form.dataset.home || '/';
        location.assign(safe);
        return;
      }
      if (action === 'home') {
        location.assign(form.dataset.home || '/');
        return;
      }
      say(form, msgs.ok ?? '', 'ok');
      if (form.dataset.reset !== undefined) form.reset();
    } else if (body.code === 'unverified') {
      say(form, msgs.unverified ?? body.error ?? '');
      form.querySelector<HTMLElement>('[data-resend]')?.removeAttribute('hidden');
    } else if (res.status === 401 && form.dataset.endpoint?.endsWith('/login')) {
      say(form, msgs.bad ?? body.error ?? '');
    } else {
      say(form, body.error ?? msgs.generic ?? '');
    }
  } catch {
    say(form, msgs.generic ?? '');
  } finally {
    if (btn) btn.disabled = false;
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
      if (form && email) {
        const msgs = JSON.parse(form.dataset.msgs ?? '{}') as Msgs;
        void fetch('/api/auth/resend', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        }).then(() => say(form, msgs.resent ?? '', 'ok'));
      }
    }
    if (t.closest('[data-signout]')) {
      void fetch('/api/auth/logout', { method: 'POST' }).then(() =>
        location.assign((t.closest('[data-signout]') as HTMLElement).dataset.home || '/'),
      );
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
    out.textContent = text;
    out.dataset.kind = kind;
  };
  if (!token) return set(root.dataset.fail ?? '', 'err');
  void fetch(root.dataset.endpoint ?? '', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  })
    .then((r) =>
      set(r.ok ? (root.dataset.ok ?? '') : (root.dataset.fail ?? ''), r.ok ? 'ok' : 'err'),
    )
    .catch(() => set(root.dataset.fail ?? '', 'err'));
}

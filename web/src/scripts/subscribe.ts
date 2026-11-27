import { busy, lockFields } from '../lib/busy';
import { api } from '../lib/client-api';
import { guardToken } from '../lib/guard-client';

/** Newsletter form: posts JSON, reports the outcome inline. Falls back to a normal form post without JS. */
document.addEventListener('submit', async (e) => {
  const form = (e.target as HTMLElement).closest<HTMLFormElement>('form[data-subscribe]');
  if (!form) return;
  e.preventDefault();
  const button = form.querySelector('button');
  if (button?.dataset.busy !== undefined) return;
  const msg = document.getElementById('sub-msg');
  const say = (text: string, kind?: 'ok' | 'err') => {
    if (!msg) return;
    msg.textContent = text;
    if (kind) msg.dataset.kind = kind;
    else delete msg.dataset.kind;
  };
  const fields = Object.fromEntries(new FormData(form).entries());
  const done = busy(button);
  const unlock = lockFields(form);
  say('');
  const guard = await guardToken().catch(() => null);
  const res = guard
    ? await api('/api/subscribe', { json: { ...fields, guard } })
    : { ok: false, status: 503 };
  await done();
  unlock();
  if (res.ok) {
    form.reset();
    say(form.dataset.ok ?? '', 'ok');
  } else say((res.status === 400 ? form.dataset.invalid : form.dataset.failed) ?? '', 'err');
});

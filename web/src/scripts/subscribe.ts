import { api } from '../lib/client-api';

/** Newsletter form: posts JSON, reports the outcome inline. Falls back to a normal form post without JS. */
document.addEventListener('submit', async (e) => {
  const form = (e.target as HTMLElement).closest<HTMLFormElement>('form[data-subscribe]');
  if (!form) return;
  e.preventDefault();
  const msg = document.getElementById('sub-msg');
  const say = (text: string) => {
    if (msg) msg.textContent = text;
  };
  const res = await api('/api/subscribe', {
    json: Object.fromEntries(new FormData(form).entries()),
  });
  say(
    res.ok
      ? (form.dataset.ok ?? '')
      : res.status === 400
        ? (form.dataset.invalid ?? '')
        : (form.dataset.failed ?? ''),
  );
  if (res.ok) form.reset();
});

import { onPage } from './page-lifecycle';
import { showToast } from './toast';

const today = () => new Date().toISOString().slice(0, 10);

/** One view per visitor per post per day; the server ignores bots and drafts. */
function countView(slug: string): void {
  const key = `sig-view-${slug}`;
  let seen: string | null = null;
  try {
    seen = localStorage.getItem(key);
  } catch {
    /* storage blocked: counts at most once per page load */
  }
  if (seen === today()) return;
  try {
    localStorage.setItem(key, today());
  } catch {
    /* ignore */
  }
  void fetch(`/pb/api/views/${encodeURIComponent(slug)}`, {
    method: 'POST',
    keepalive: true,
  }).catch(() => {});
}

function reading(signal: AbortSignal): void {
  const bar = document.getElementById('rp-bar');
  const ring = document.getElementById('ring-fg');
  const num = document.getElementById('ring-num');
  const update = () => {
    const h = document.documentElement;
    const k = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    if (bar) bar.style.width = `${k * 100}%`;
    ring?.setAttribute('style', `stroke-dashoffset:${201 * (1 - k)}`);
    if (num) num.textContent = `${Math.round(k * 100)}%`;
  };
  addEventListener('scroll', update, { passive: true, signal });
  update();
}

/** Highlights the table-of-contents entry of the section being read. */
function tocSpy(): (() => void) | undefined {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('#toc a')];
  if (!('IntersectionObserver' in window) || !links.length) return undefined;
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting)
          for (const a of links) a.classList.toggle('on', a.hash === `#${e.target.id}`);
      }
    },
    { rootMargin: '-15% 0px -75% 0px' },
  );
  for (const h of document.querySelectorAll('.prose h2[id]')) spy.observe(h);
  return () => spy.disconnect();
}

onPage((signal) => {
  const main = document.querySelector<HTMLElement>('main[data-post-slug]');
  if (!main) return undefined;
  reading(signal);
  const stopSpy = tocSpy();
  const slug = main.dataset.postSlug;
  if (main.dataset.track === 'view' && slug && !navigator.webdriver) countView(slug);

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element;
      if (target.closest('[data-share]')) {
        void navigator.clipboard?.writeText(location.href.split('#')[0] ?? '').catch(() => {});
        showToast(document.documentElement.lang === 'fa' ? 'پیوند کپی شد' : 'Link copied');
      }
    },
    { signal },
  );
  return stopSpy;
});

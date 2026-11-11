import { fragmentParts, quoteLink, selectionQuote } from '../lib/text-fragment';
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

const fa = () => document.documentElement.lang === 'fa';

/** A floating "Copy link to quote" button next to any selection inside the article. */
function quoteButton(signal: AbortSignal): void {
  let btn: HTMLButtonElement | null = null;
  const hide = () => {
    btn?.remove();
    btn = null;
  };
  document.addEventListener(
    'selectionchange',
    () => {
      const sel = getSelection();
      const text = selectionQuote(sel);
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      const inProse =
        range && document.querySelector('.prose')?.contains(range.commonAncestorContainer);
      if (!text || !range || !inProse) return hide();
      const r = range.getBoundingClientRect();
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quote-btn';
        btn.dataset.quote = '';
        btn.textContent = fa() ? 'کپی پیوند نقل‌قول' : 'Copy link to quote';
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
          const t = selectionQuote(getSelection());
          void navigator.clipboard?.writeText(quoteLink(location.href, t)).catch(() => {});
          showToast(fa() ? 'پیوند نقل‌قول کپی شد' : 'Quote link copied');
          hide();
        });
        document.body.append(btn);
      }
      btn.style.top = `${scrollY + r.top - 42}px`;
      btn.style.left = `${Math.max(8, Math.min(scrollX + r.left + r.width / 2 - 60, scrollX + innerWidth - 170))}px`;
    },
    { signal },
  );
  signal.addEventListener('abort', hide);
}

/** Fonts and diagrams change the layout after load, which leaves a #hash target off-screen: scroll again once they settle. */
function keepHash(signal: AbortSignal): void {
  const go = () => {
    if (!location.hash || location.hash.startsWith('#:~:')) return;
    try {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    } catch {
      /* malformed hash */
    }
  };
  void document.fonts?.ready.then(() => !signal.aborted && go());
  const t = setTimeout(go, 1200);
  signal.addEventListener('abort', () => clearTimeout(t));
}

/**
 * Highlights and scrolls to a shared quote ourselves. Browsers do it natively for a fresh navigation, but not when the
 * link is opened in a page that is already loaded, and not through the client router.
 */
function showQuote(signal: AbortSignal): void {
  const nav = performance.getEntriesByType('navigation')[0]?.name ?? location.href;
  const parts = fragmentParts(nav);
  const prose = document.querySelector('.prose');
  if (!parts || !prose || !('highlights' in CSS)) return;
  const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let text = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: text.length });
    text += (n.textContent ?? '').replace(/\s+/g, ' ');
  }
  const hay = text.toLowerCase();
  const first = hay.indexOf((parts[0] ?? '').toLowerCase());
  if (first < 0) return;
  const lastPart = (parts[1] ?? parts[0] ?? '').toLowerCase();
  const last = hay.indexOf(lastPart, first);
  const end = (last < 0 ? first : last) + lastPart.length;
  const at = (pos: number) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const it = nodes[i];
      if (it && pos >= it.start)
        return { node: it.node, offset: Math.min(pos - it.start, it.node.length) };
    }
    return null;
  };
  const a = at(first);
  const b = at(end);
  if (!a || !b) return;
  const range = new Range();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  (CSS as unknown as { highlights: Map<string, unknown> }).highlights.set(
    'quote',
    new (window as unknown as { Highlight: new (r: Range) => unknown }).Highlight(range),
  );
  range.startContainer.parentElement?.scrollIntoView({ block: 'center' });
  signal.addEventListener('abort', () =>
    (CSS as unknown as { highlights: Map<string, unknown> }).highlights.delete('quote'),
  );
}

onPage((signal) => {
  const main = document.querySelector<HTMLElement>('main[data-post-slug]');
  if (!main) return undefined;
  reading(signal);
  quoteButton(signal);
  keepHash(signal);
  showQuote(signal);
  const stopSpy = tocSpy();
  const slug = main.dataset.postSlug;
  if (main.dataset.track === 'view' && slug && !navigator.webdriver) countView(slug);

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element;
      const anchor = target.closest<HTMLAnchorElement>('.prose a.anchor');
      if (anchor) {
        void navigator.clipboard?.writeText(new URL(anchor.href).href).catch(() => {});
        showToast(fa() ? 'پیوند کپی شد' : 'Link copied');
      }
      if (target.closest('[data-share]')) {
        void navigator.clipboard?.writeText(location.href.split('#')[0] ?? '').catch(() => {});
        showToast(document.documentElement.lang === 'fa' ? 'پیوند کپی شد' : 'Link copied');
      }
    },
    { signal },
  );
  return stopSpy;
});

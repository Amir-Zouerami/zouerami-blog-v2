import { destinationLabel, shouldAnimate } from '../lib/wipe';

/** Longest the curtain may stay down. It must outlast a slow page: lifting it while the next page is still loading made navigation look like it did nothing. */
const SAFETY_MS = 25_000;
let pending = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function overlay(): HTMLElement | null {
  return document.getElementById('wipe');
}

function clear(): void {
  clearTimeout(timer);
  const el = overlay();
  if (!el) return;
  el.classList.remove('on');
  el.style.transform = '';
  el.hidden = true;
}

const EASE = 'cubic-bezier(.76,0,.24,1)';
const COVER_MS = 380;
const REVEAL_MS = 440;
/** Two frames: lets the new page paint and its islands start hydrating before the curtain lifts, so the lift is not janky. */
const settle = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

async function cover(label: string): Promise<void> {
  const el = overlay();
  if (!el) return;
  const text = el.querySelector('div');
  if (text) text.textContent = label;
  el.hidden = false;
  el.classList.add('on');
  clearTimeout(timer);
  timer = setTimeout(clear, SAFETY_MS);
  await el.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], {
    duration: COVER_MS,
    easing: EASE,
    fill: 'both',
  }).finished;
}

async function reveal(): Promise<void> {
  const el = overlay();
  if (!el?.classList.contains('on')) return;
  try {
    await el.animate([{ transform: 'none' }, { transform: 'translateY(-100%)' }], {
      duration: REVEAL_MS,
      easing: EASE,
      fill: 'both',
    }).finished;
  } finally {
    clear();
  }
}

/** Wipe + destination name, hooked into Astro's client router. Safe to call more than once. */
export function initWipe(): void {
  const w = window as unknown as { __sigWipe?: boolean };
  if (w.__sigWipe) return;
  w.__sigWipe = true;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('astro:before-preparation', (e) => {
    const ev = e as Event & { to: URL; from: URL; loader: () => Promise<void> };
    if (!shouldAnimate(reduced()) || ev.to.pathname === ev.from.pathname) return;
    const original = ev.loader;
    ev.loader = async () => {
      // fetch the next page WHILE the curtain comes down (it used to wait for the curtain first: two sequential delays)
      pending = true;
      const loading = original();
      void loading.catch(() => {}); // handled below; keeps an early failure from being reported as unhandled
      try {
        await cover(destinationLabel(ev.to));
      } catch {
        clear();
      }
      try {
        await loading;
      } catch (err) {
        clear();
        throw err;
      } finally {
        pending = false;
      }
    };
  });
  document.addEventListener('astro:page-load', () => {
    void settle().then(reveal);
  });
  // Any failure path must never leave the screen covered.
  window.addEventListener('pageshow', clear);
  // an unrelated script error must not lift the curtain in the middle of a navigation
  window.addEventListener('error', () => setTimeout(() => !pending && clear(), 2500));
}

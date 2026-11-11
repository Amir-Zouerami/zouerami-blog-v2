import { destinationLabel, shouldAnimate } from '../lib/wipe';

const SAFETY_MS = 2500;
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

const EASE = 'cubic-bezier(.7,0,.2,1)';

async function cover(label: string): Promise<void> {
  const el = overlay();
  if (!el) return;
  const text = el.querySelector('div');
  if (text) text.textContent = label;
  el.hidden = false;
  el.classList.add('on');
  clearTimeout(timer);
  timer = setTimeout(clear, SAFETY_MS + 3000);
  await el.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], {
    duration: 650,
    easing: EASE,
    fill: 'both',
  }).finished;
}

async function reveal(): Promise<void> {
  const el = overlay();
  if (!el?.classList.contains('on')) return;
  try {
    await el.animate([{ transform: 'none' }, { transform: 'translateY(-100%)' }], {
      duration: 650,
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
      try {
        await cover(destinationLabel(ev.to));
      } catch {
        clear();
      }
      try {
        await original();
      } catch (err) {
        clear();
        throw err;
      }
    };
  });
  document.addEventListener('astro:page-load', () => {
    void reveal();
  });
  // Any failure path must never leave the screen covered.
  window.addEventListener('pageshow', clear);
  window.addEventListener('error', () => setTimeout(clear, SAFETY_MS));
}

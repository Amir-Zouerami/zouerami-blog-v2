import { api } from '../lib/client-api';
import { applyTheme } from '../lib/theme';
import { initCursor } from './cursor';
import { onPage } from './page-lifecycle';
import { initWipe } from './wipe';

const LANG_KEY = 'sig-lang';
const lang = {
  get: (): string | null => {
    try {
      return localStorage.getItem(LANG_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string): void => {
    try {
      localStorage.setItem(LANG_KEY, v);
    } catch {
      /* storage blocked: the choice just is not remembered */
    }
  },
};

const pad = (n: number) => String(n).padStart(2, '0');

function tick(): void {
  const d = new Date();
  for (const el of document.querySelectorAll<HTMLElement>('[data-clock]')) {
    el.textContent = `${el.dataset.label ?? 'Local'} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}

/** Header link: "Sign in" for visitors, the user's name once signed in (only asks the server when a hint cookie says so). */
async function showAccount(): Promise<void> {
  const link = document.querySelector<HTMLAnchorElement>('[data-me]');
  if (!link) return;
  const signedIn = document.cookie.split('; ').includes('signed_in=1');
  if (!signedIn) {
    link.href = link.dataset.loginHref ?? '/login';
    link.textContent = link.dataset.labelIn ?? '';
    delete link.dataset.signedIn;
    return;
  }
  try {
    const res = await api<{ user: { name: string } }>('/api/auth/me');
    const user = res.data?.user;
    if (!res.ok || !user) return;
    link.href = link.dataset.accountHref ?? '/account';
    link.textContent = user.name.length > 14 ? `${user.name.slice(0, 13)}…` : user.name;
    link.dataset.signedIn = '';
  } catch {
    /* keep the sign-in link */
  }
}

/** Soft green glow following the pointer (post pages only). */
function spotlight(signal: AbortSignal): void {
  const spot = document.getElementById('spot');
  if (!spot || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let mx = innerWidth / 2;
  let my = innerHeight / 3;
  let x = mx;
  let y = my;
  addEventListener(
    'pointermove',
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      spot.classList.add('on');
    },
    { signal },
  );
  const frame = () => {
    if (signal.aborted || !spot.isConnected) return;
    x += (mx - x) * 0.14;
    y += (my - y) * 0.14;
    spot.style.transform = `translate(${x}px,${y}px)`;
    requestAnimationFrame(frame);
  };
  frame();
}

/** Hint (never a redirect) for visitors who previously chose Persian. */
function languageHint(): void {
  const hint = document.getElementById('langhint');
  if (hint) hint.hidden = !(hint.dataset.locale === 'en' && lang.get() === 'fa');
}

function copyCode(button: HTMLElement): void {
  const code = button.closest('.term')?.querySelector('pre')?.textContent ?? '';
  void navigator.clipboard?.writeText(code).catch(() => {});
  const label = button.textContent;
  button.textContent = '✓';
  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

/** One delegated click handler for the whole site (survives client-router swaps). */
function onClick(e: MouseEvent): void {
  const target = e.target as Element;
  if (target.closest('[data-theme-toggle]')) {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  } else if (target.closest('[data-palette-open]')) {
    window.dispatchEvent(new Event('palette:open'));
  } else if (target.closest('[data-lang-switch]')) {
    lang.set((target.closest('[data-lang-switch]') as HTMLElement).dataset.langSwitch ?? 'en');
  } else if (target.closest('[data-lang-go]')) {
    lang.set('fa');
  } else if (target.closest('[data-lang-dismiss]')) {
    lang.set('en');
    (document.getElementById('langhint') as HTMLElement).hidden = true;
  } else if (target.closest('.copy')) {
    copyCode(target.closest('.copy') as HTMLElement);
  }
}

export function initSite(): void {
  initCursor();
  initWipe();
  setInterval(tick, 1000);
  document.addEventListener('click', onClick);
  onPage((signal) => {
    tick();
    languageHint();
    void showAccount();
    spotlight(signal);
  });
}

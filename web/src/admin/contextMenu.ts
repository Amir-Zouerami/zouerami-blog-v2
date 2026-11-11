import type { KeyboardEvent, MouseEvent } from 'react';
import { icons, type MenuEntry, showMenu } from '../lib/context-menu';

/** Props to spread on any element to give it a right-click / Menu-key / Shift+F10 context menu. */
export function contextMenuProps(items: () => MenuEntry[], label?: string) {
  return {
    onContextMenu(e: MouseEvent) {
      if (e.shiftKey) return; // Shift+right-click keeps the browser's menu
      e.preventDefault();
      showMenu({ x: e.clientX, y: e.clientY, items: items(), label });
    },
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      const origin = e.target instanceof HTMLElement ? e.target : e.currentTarget;
      const at = origin.getBoundingClientRect();
      showMenu({
        x: at.left || r.left,
        y: at.bottom || r.bottom,
        items: items(),
        label,
        keyboard: true,
        restoreFocus: origin,
      });
    },
  };
}

export async function copyText(
  text: string,
  toast: (m: string, k?: 'ok' | 'err') => void,
  what = 'Copied',
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(what);
  } catch {
    toast('Could not access the clipboard', 'err');
  }
}

export const goto = (hash: string): void => {
  location.hash = hash;
};
export const openTab = (url: string): void => {
  window.open(url, '_blank', 'noopener');
};
export const mailTo = (email: string): void => {
  location.href = `mailto:${email}`;
};

export { icons };

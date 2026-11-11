import { showMenu } from './core';
import type { MenuEntry } from './types';

/** Returns the menu for what was right-clicked, or null to leave the browser's own menu alone. */
export type Resolver = (
  target: Element,
  trigger: { x: number; y: number; keyboard: boolean },
) => MenuEntry[] | null;

export interface BindOptions {
  label?: string;
  /** Finger held this long (ms) opens the menu on touch screens. */
  longPressMs?: number;
}

/** Elements whose native menu people rely on (spell-check, paste, …). */
export const NATIVE_MENU =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor, [data-native-menu]';

/**
 * Wires a resolver to a root: right-click, the Menu key / Shift+F10, and long-press on touch.
 * Shift+right-click always shows the browser's menu (the usual escape hatch).
 */
export function bindContextMenu(
  root: Document | HTMLElement,
  resolve: Resolver,
  opts: BindOptions = {},
): () => void {
  const open = (
    target: EventTarget | null,
    x: number,
    y: number,
    keyboard: boolean,
    restore?: HTMLElement | null,
  ) => {
    if (!(target instanceof Element)) return false;
    const items = resolve(target, { x, y, keyboard });
    if (!items?.length) return false;
    showMenu({ x, y, items, label: opts.label, keyboard, restoreFocus: restore ?? null });
    return true;
  };

  const onContextMenu = (e: Event) => {
    const ev = e as MouseEvent;
    if (ev.shiftKey || ev.defaultPrevented) return;
    // a contextmenu event with no pointer position comes from the keyboard
    const fromKeyboard =
      ev.button === 0 &&
      ev.clientX === 0 &&
      ev.clientY === 0 &&
      ev.detail === 0 &&
      document.activeElement !== document.body;
    if (fromKeyboard) return; // handled by onKeyDown with a proper anchor
    if (open(ev.target, ev.clientX, ev.clientY, false)) ev.preventDefault();
  };

  const onKeyDown = (e: Event) => {
    const ev = e as KeyboardEvent;
    if (!(ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10'))) return;
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) return;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    if (open(el, rtl ? r.right : r.left, r.bottom, true, el)) ev.preventDefault();
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  let origin: { x: number; y: number } | null = null;
  const cancel = () => {
    clearTimeout(timer);
    origin = null;
  };
  const onPointerDown = (e: Event) => {
    const ev = e as PointerEvent;
    if (ev.pointerType !== 'touch') return;
    origin = { x: ev.clientX, y: ev.clientY };
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (origin) open(ev.target, origin.x, origin.y, false);
      origin = null;
    }, opts.longPressMs ?? 520);
  };
  const onPointerMove = (e: Event) => {
    const ev = e as PointerEvent;
    if (origin && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) > 10) cancel();
  };

  root.addEventListener('contextmenu', onContextMenu);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
  return () => {
    cancel();
    root.removeEventListener('contextmenu', onContextMenu);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', cancel);
    root.removeEventListener('pointercancel', cancel);
  };
}

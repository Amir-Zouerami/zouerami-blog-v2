import { cycle, firstEnabled, lastEnabled, normalize, typeaheadFind } from './model';
import { placeMenu, placeSubmenu } from './placement';
import { isAction, type MenuAction, type MenuEntry } from './types';

export interface ShowOptions {
  x: number;
  y: number;
  items: MenuEntry[];
  /** Accessible name of the menu. */
  label?: string;
  /** Opened from the keyboard: focus the first item, and give focus back to `restoreFocus` on close. */
  keyboard?: boolean;
  restoreFocus?: HTMLElement | null;
  onClose?: () => void;
}

export interface MenuHandle {
  close: () => void;
}

interface Level {
  el: HTMLElement;
  entries: MenuEntry[];
  /** Interactive rows only (separators and labels excluded), parallel to `actions`. */
  buttons: HTMLButtonElement[];
  actions: MenuAction[];
  /** The parent row that opened this level (submenus). */
  owner?: HTMLButtonElement;
  active: number;
}

interface Open {
  levels: Level[];
  opts: ShowOptions;
  teardown: () => void;
  typeBuffer: string;
  typeTimer?: ReturnType<typeof setTimeout>;
  hoverTimer?: ReturnType<typeof setTimeout>;
}

let open: Open | null = null;

const isRtl = () => getComputedStyle(document.documentElement).direction === 'rtl';
/** Layout viewport (excludes scrollbars): `position: fixed` is measured against this, not window.innerWidth. */
const viewport = () => ({
  w: document.documentElement.clientWidth,
  h: document.documentElement.clientHeight,
});
const enabledOf = (l: Level) => l.actions.map((a) => !a.disabled);

export function isMenuOpen(): boolean {
  return open !== null;
}

export function closeMenu(): void {
  if (!open) return;
  const o = open;
  open = null;
  clearTimeout(o.typeTimer);
  clearTimeout(o.hoverTimer);
  o.teardown();
  for (const l of o.levels) l.el.remove();
  if (o.opts.keyboard && o.opts.restoreFocus?.isConnected)
    o.opts.restoreFocus.focus({ preventScroll: true });
  o.opts.onClose?.();
}

function buildLevel(
  entries: MenuEntry[],
  label: string | undefined,
  owner?: HTMLButtonElement,
): Level {
  const el = document.createElement('div');
  el.className = 'ctx';
  el.setAttribute('role', 'menu');
  el.tabIndex = -1;
  if (label) el.setAttribute('aria-label', label);
  const level: Level = { el, entries, buttons: [], actions: [], owner, active: -1 };

  for (const entry of entries) {
    if (entry.type === 'separator') {
      const hr = document.createElement('div');
      hr.className = 'ctx-sep';
      hr.setAttribute('role', 'separator');
      el.append(hr);
      continue;
    }
    if (entry.type === 'label') {
      const lab = document.createElement('div');
      lab.className = 'ctx-label';
      lab.setAttribute('role', 'presentation');
      lab.textContent = entry.label;
      el.append(lab);
      continue;
    }
    if (!isAction(entry)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.tabIndex = -1;
    b.className = 'ctx-item';
    b.setAttribute('role', entry.checked !== undefined ? 'menuitemcheckbox' : 'menuitem');
    if (entry.checked !== undefined) b.setAttribute('aria-checked', String(entry.checked));
    if (entry.disabled) {
      b.setAttribute('aria-disabled', 'true');
      b.dataset.disabled = '';
    }
    if (entry.danger) b.dataset.danger = '';
    if (entry.children) {
      b.setAttribute('aria-haspopup', 'menu');
      b.setAttribute('aria-expanded', 'false');
    }
    const icon = document.createElement('span');
    icon.className = 'ctx-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (entry.checked) icon.innerHTML = '✓';
    else if (entry.icon) icon.innerHTML = entry.icon; // trusted markup from icons.ts only
    const text = document.createElement('span');
    text.className = 'ctx-text';
    text.textContent = entry.label;
    const tail = document.createElement('span');
    tail.className = entry.children ? 'ctx-arrow' : 'ctx-shortcut';
    tail.setAttribute('aria-hidden', 'true');
    tail.textContent = entry.children ? '▸' : (entry.shortcut ?? '');
    b.append(icon, text, tail);
    el.append(b);
    level.buttons.push(b);
    level.actions.push(entry);
  }
  return level;
}

function setActive(level: Level, index: number, focus = true): void {
  level.buttons.forEach((b, i) => {
    if (i === index) b.dataset.active = '';
    else delete b.dataset.active;
  });
  level.active = index;
  if (focus && index >= 0) level.buttons[index]?.focus({ preventScroll: true });
}

function position(
  level: Level,
  place: (w: number, h: number) => ReturnType<typeof placeMenu>,
): void {
  const { el } = level;
  el.style.visibility = 'hidden';
  document.body.append(el);
  // layout size: unaffected by the scale-in animation's transform (getBoundingClientRect would be ~4% too small)
  const p = place(el.offsetWidth, el.offsetHeight);
  el.style.left = `${p.left}px`;
  el.style.top = `${p.top}px`;
  el.style.setProperty('--ox', p.originX);
  el.style.setProperty('--oy', p.originY);
  el.style.visibility = '';
}

function closeLevelsAfter(o: Open, depth: number): void {
  while (o.levels.length > depth + 1) {
    const l = o.levels.pop();
    l?.owner?.setAttribute('aria-expanded', 'false');
    l?.el.remove();
  }
}

function openSubmenu(o: Open, from: Level, index: number, viaKeyboard: boolean): void {
  const action = from.actions[index];
  const owner = from.buttons[index];
  if (!action?.children || action.disabled || !owner) return;
  const depth = o.levels.indexOf(from);
  closeLevelsAfter(o, depth);
  const entries = normalize(action.children);
  if (!entries.length) return;
  const sub = buildLevel(entries, action.label, owner);
  owner.setAttribute('aria-expanded', 'true');
  const anchor = owner.getBoundingClientRect();
  position(sub, (w, h) => placeSubmenu(anchor, { w, h }, viewport(), isRtl()));
  o.levels.push(sub);
  wireLevel(o, sub);
  if (viaKeyboard) setActive(sub, firstEnabled(enabledOf(sub)));
}

function select(o: Open, level: Level, index: number): void {
  const action = level.actions[index];
  if (!action || action.disabled) return;
  if (action.children) {
    openSubmenu(o, level, index, true);
    return;
  }
  closeMenu();
  try {
    const result = action.onSelect?.();
    if (result instanceof Promise)
      result.catch((err) => console.error('[context-menu]', action.id, err));
  } catch (err) {
    console.error('[context-menu]', action.id, err);
  }
}

function wireLevel(o: Open, level: Level): void {
  level.buttons.forEach((b, i) => {
    b.addEventListener('pointerenter', () => {
      const depth = o.levels.indexOf(level);
      clearTimeout(o.hoverTimer);
      setActive(level, level.actions[i]?.disabled ? -1 : i);
      if (level.actions[i]?.children && !level.actions[i]?.disabled) {
        o.hoverTimer = setTimeout(() => openSubmenu(o, level, i, false), 140);
      } else {
        o.hoverTimer = setTimeout(() => closeLevelsAfter(o, depth), 220);
      }
    });
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      select(o, level, i);
    });
  });
  // keep the pointer from starting a text selection or a native menu on the menu itself
  level.el.addEventListener('contextmenu', (e) => e.preventDefault());
  level.el.addEventListener('pointerdown', (e) => e.preventDefault());
}

function onKey(o: Open, e: KeyboardEvent): void {
  const level = o.levels[o.levels.length - 1] as Level;
  const enabled = enabledOf(level);
  const rtl = isRtl();
  const intoSub = rtl ? 'ArrowLeft' : 'ArrowRight';
  const outOfSub = rtl ? 'ArrowRight' : 'ArrowLeft';
  // any navigation key ends the current type-ahead search ("go" → ArrowRight → "blog" must start fresh)
  if (e.key.length > 1) o.typeBuffer = '';
  const handled = () => {
    e.preventDefault();
    e.stopPropagation();
  };
  switch (e.key) {
    case 'Escape':
      handled();
      if (o.levels.length > 1) {
        const owner = level.owner;
        closeLevelsAfter(o, o.levels.length - 2);
        owner?.focus({ preventScroll: true });
      } else {
        // Esc is a keyboard action: always hand focus back
        o.opts.keyboard = true;
        closeMenu();
      }
      return;
    case 'Tab':
      closeMenu();
      return;
    case 'ArrowDown':
      handled();
      setActive(level, cycle(level.active, 1, enabled));
      return;
    case 'ArrowUp':
      handled();
      setActive(
        level,
        level.active === -1 ? lastEnabled(enabled) : cycle(level.active, -1, enabled),
      );
      return;
    case 'Home':
      handled();
      setActive(level, firstEnabled(enabled));
      return;
    case 'End':
      handled();
      setActive(level, lastEnabled(enabled));
      return;
    case 'Enter':
      handled();
      if (level.active >= 0) select(o, level, level.active);
      return;
    case ' ':
      if (o.typeBuffer) break; // part of a type-ahead search ("copy l")
      handled();
      if (level.active >= 0) select(o, level, level.active);
      return;
    default:
      break;
  }
  if (e.key === intoSub && level.active >= 0 && level.actions[level.active]?.children) {
    handled();
    openSubmenu(o, level, level.active, true);
  } else if (e.key === outOfSub && o.levels.length > 1) {
    handled();
    const owner = level.owner;
    closeLevelsAfter(o, o.levels.length - 2);
    owner?.focus({ preventScroll: true });
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    handled();
    clearTimeout(o.typeTimer);
    o.typeBuffer += e.key;
    o.typeTimer = setTimeout(() => {
      o.typeBuffer = '';
    }, 700);
    const hit = typeaheadFind(
      level.actions.map((a) => a.label),
      enabled,
      o.typeBuffer,
      level.active,
    );
    if (hit >= 0) setActive(level, hit);
  }
}

/** Opens a context menu at viewport coordinates. Only one menu is ever open; opening another replaces it. */
export function showMenu(opts: ShowOptions): MenuHandle {
  closeMenu();
  const entries = normalize(opts.items);
  if (!entries.length) return { close: () => {} };

  const root = buildLevel(entries, opts.label);
  position(root, (w, h) => placeMenu({ x: opts.x, y: opts.y }, { w, h }, viewport(), isRtl()));

  const o: Open = { levels: [root], opts, teardown: () => {}, typeBuffer: '' };
  open = o;
  wireLevel(o, root);

  const inside = (t: EventTarget | null) =>
    t instanceof Node && o.levels.some((l) => l.el.contains(t));
  const onPointerDown = (e: PointerEvent) => {
    if (!inside(e.target)) closeMenu();
  };
  const onKeyDown = (e: KeyboardEvent) => onKey(o, e);
  const closeIfOutside = (e: Event) => {
    if (!inside(e.target)) closeMenu();
  };
  const onSwap = () => closeMenu();
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('wheel', closeIfOutside, { capture: true, passive: true });
  document.addEventListener('scroll', closeIfOutside, { capture: true, passive: true });
  document.addEventListener('astro:before-swap', onSwap);
  window.addEventListener('resize', onSwap);
  window.addEventListener('blur', onSwap);
  window.addEventListener('contextmenu', closeIfOutside, true);
  o.teardown = () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('wheel', closeIfOutside, true);
    document.removeEventListener('scroll', closeIfOutside, true);
    document.removeEventListener('astro:before-swap', onSwap);
    window.removeEventListener('resize', onSwap);
    window.removeEventListener('blur', onSwap);
    window.removeEventListener('contextmenu', closeIfOutside, true);
  };

  // pointer-opened menus start with nothing highlighted (no accidental Enter); keyboard-opened ones start on the first item
  if (opts.keyboard) setActive(root, firstEnabled(enabledOf(root)));
  else root.el.focus({ preventScroll: true });
  return { close: closeMenu };
}

export interface MenuAction {
  type?: 'item';
  id: string;
  label: string;
  /** Trusted inline SVG markup (see icons.ts) shown in the leading slot. */
  icon?: string;
  /** Visual hint only, e.g. "⌘K". The menu does not bind it. */
  shortcut?: string;
  disabled?: boolean;
  /** Removed from the menu entirely. Handy for `cond && {...}`-free building. */
  hidden?: boolean;
  /** Destructive: drawn in red. */
  danger?: boolean;
  /** Renders as a checkable item (`role="menuitemcheckbox"`). */
  checked?: boolean;
  onSelect?: () => void | Promise<void>;
  /** Makes this a submenu parent. */
  children?: MenuEntry[];
}
export interface MenuSeparator {
  type: 'separator';
}
export interface MenuLabel {
  type: 'label';
  label: string;
}
export type MenuEntry = MenuAction | MenuSeparator | MenuLabel;

export const isAction = (e: MenuEntry): e is MenuAction =>
  e.type === undefined || e.type === 'item';

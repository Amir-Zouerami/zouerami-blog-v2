export const THEME_KEY = 'sig-theme';
export type Theme = 'dark' | 'light';

/** Stored theme, or 'dark' when nothing valid is stored or storage is unavailable. */
export function readTheme(storage?: Pick<Storage, 'getItem'>): Theme {
  try {
    const s = storage ?? localStorage;
    const v = s.getItem(THEME_KEY);
    return v === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
  storage?: Pick<Storage, 'setItem'>,
): void {
  root.dataset.theme = theme;
  try {
    (storage ?? localStorage).setItem(THEME_KEY, theme);
  } catch {
    /* private mode / blocked storage: theme still applies for this page */
  }
}

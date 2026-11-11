import type { Locale } from '../i18n';
import { localePath, t } from '../i18n';

export interface Command {
  id: string;
  label: string;
  hint: string;
  href?: string;
  run?: 'toggle-theme';
}

export function staticCommands(locale: Locale): Command[] {
  const tr = t(locale);
  return [
    { id: 'home', label: tr.nav.home, hint: tr.palette.page, href: localePath(locale, '/') },
    { id: 'blog', label: tr.nav.blog, hint: tr.palette.page, href: localePath(locale, '/blog') },
    { id: 'work', label: tr.nav.work, hint: tr.palette.page, href: localePath(locale, '/work') },
    { id: 'about', label: tr.nav.about, hint: tr.palette.page, href: localePath(locale, '/about') },
    { id: 'theme', label: tr.toggleTheme, hint: tr.palette.action, run: 'toggle-theme' },
  ];
}

export const STATIC_COMMANDS: Command[] = staticCommands('en');

export function filterCommands(all: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  return all.filter((c) => !q || c.label.toLowerCase().includes(q)).slice(0, 14);
}

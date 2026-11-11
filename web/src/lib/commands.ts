export interface Command {
  id: string;
  label: string;
  hint: string;
  href?: string;
  run?: 'toggle-theme';
}

export const STATIC_COMMANDS: Command[] = [
  { id: 'home', label: 'Home', hint: 'page', href: '/' },
  { id: 'blog', label: 'Blog', hint: 'page', href: '/blog' },
  { id: 'work', label: 'Work', hint: 'page', href: '/work' },
  { id: 'about', label: 'About', hint: 'page', href: '/about' },
  { id: 'theme', label: 'Toggle theme', hint: 'action', run: 'toggle-theme' },
];

export function filterCommands(all: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  return all.filter((c) => !q || c.label.toLowerCase().includes(q)).slice(0, 14);
}

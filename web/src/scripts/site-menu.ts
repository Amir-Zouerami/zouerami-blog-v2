import { bindContextMenu, icons, type MenuEntry, NATIVE_MENU } from '../lib/context-menu';
import { quoteLink } from '../lib/text-fragment';
import { applyTheme } from '../lib/theme';
import { showToast } from './toast';

interface Labels {
  search: string;
  searchFor: string;
  goTo: string;
  toggleTheme: string;
  language: string;
  copyPageLink: string;
  back: string;
  reload: string;
  openLink: string;
  openNewTab: string;
  copyLink: string;
  openImage: string;
  copyImage: string;
  copy: string;
  copySection: string;
  copyHighlight: string;
  copied: string;
  label: string;
}

function readLabels(): Labels | null {
  try {
    return JSON.parse(
      document.getElementById('menu-labels')?.textContent ?? 'null',
    ) as Labels | null;
  } catch {
    return null;
  }
}

async function go(href: string): Promise<void> {
  try {
    const { navigate } = await import('astro:transitions/client');
    await navigate(href);
  } catch {
    location.assign(href);
  }
}

async function copy(text: string, labels: Labels): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(labels.copied);
  } catch {
    showToast(text); // clipboard blocked: at least show what would have been copied
  }
}

const abs = (href: string) => new URL(href, location.href).href;

/** Items for what was right-clicked: the thing itself first, then the page-level actions. */
function resolve(target: Element, labels: Labels): MenuEntry[] | null {
  if (target.closest(`${NATIVE_MENU}, .ctx, .pal-bg, #wipe, [data-no-ctx]`)) return null;
  const context: MenuEntry[] = [];

  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (link) {
    const href = abs(link.getAttribute('href') ?? '');
    context.push(
      {
        id: 'open',
        label: labels.openLink,
        icon: icons.open,
        onSelect: () =>
          link.target === '_blank' ? void window.open(href, '_blank', 'noopener') : go(href),
      },
      {
        id: 'open-tab',
        label: labels.openNewTab,
        icon: icons.external,
        onSelect: () => void window.open(href, '_blank', 'noopener'),
      },
      {
        id: 'copy-link',
        label: labels.copyLink,
        icon: icons.link,
        onSelect: () => copy(href, labels),
      },
    );
  }

  const img = target.closest<HTMLImageElement>('.prose img');
  if (img) {
    if (context.length) context.push({ type: 'separator' });
    context.push(
      {
        id: 'open-img',
        label: labels.openImage,
        icon: icons.image,
        onSelect: () => void window.open(img.currentSrc || img.src, '_blank', 'noopener'),
      },
      {
        id: 'copy-img',
        label: labels.copyImage,
        icon: icons.link,
        onSelect: () => copy(img.currentSrc || img.src, labels),
      },
    );
  }

  const selected = window.getSelection()?.toString().trim() ?? '';
  if (selected) {
    if (context.length) context.push({ type: 'separator' });
    const short = selected.length > 28 ? `${selected.slice(0, 27)}…` : selected;
    context.push(
      {
        id: 'copy',
        label: labels.copy,
        icon: icons.copy,
        shortcut: 'Ctrl+C',
        onSelect: () => copy(selected, labels),
      },
      ...(target.closest('.prose')
        ? [
            {
              id: 'copy-highlight',
              label: labels.copyHighlight,
              icon: icons.link,
              onSelect: () => copy(quoteLink(location.href, selected), labels),
            },
          ]
        : []),
      {
        id: 'search-sel',
        label: labels.searchFor.replace('{q}', short),
        icon: icons.search,
        onSelect: () =>
          void window.dispatchEvent(
            new CustomEvent('palette:open', { detail: { query: selected } }),
          ),
      },
    );
  }

  const heading = target.closest<HTMLElement>('.prose :is(h2,h3,h4,h5,h6)[id]');
  if (heading) {
    if (context.length) context.push({ type: 'separator' });
    context.push({
      id: 'copy-section',
      label: labels.copySection,
      icon: icons.link,
      onSelect: () => copy(`${location.origin}${location.pathname}#${heading.id}`, labels),
    });
  }

  // page-level group
  const nav = [...document.querySelectorAll<HTMLAnchorElement>('nav.nav a')].map((a) => ({
    id: `go-${a.getAttribute('href')}`,
    label: (a.textContent ?? '').replace(/^\d+/, '').trim(),
    checked: a.getAttribute('aria-current') === 'page' ? true : undefined,
    onSelect: () => go(a.href),
  }));
  const switcher = document.querySelector<HTMLAnchorElement>('a[data-lang-switch]');
  const fa = document.documentElement.lang === 'fa';
  const language: MenuEntry[] = switcher
    ? [
        {
          id: 'lang-en',
          label: 'English',
          checked: !fa ? true : undefined,
          onSelect: () => (fa ? go(switcher.href) : undefined),
        },
        {
          id: 'lang-fa',
          label: 'فارسی',
          checked: fa ? true : undefined,
          onSelect: () => (fa ? undefined : go(switcher.href)),
        },
      ]
    : [];

  const page: MenuEntry[] = [
    {
      id: 'search',
      label: labels.search,
      icon: icons.search,
      shortcut: 'Ctrl+K',
      onSelect: () => void window.dispatchEvent(new CustomEvent('palette:open')),
    },
    { id: 'goto', label: labels.goTo, icon: icons.home, children: nav, hidden: !nav.length },
    {
      id: 'theme',
      label: labels.toggleTheme,
      icon: icons.theme,
      onSelect: () =>
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'language',
      label: labels.language,
      icon: icons.globe,
      children: language,
      hidden: !language.length,
    },
    {
      id: 'copy-page',
      label: labels.copyPageLink,
      icon: icons.link,
      onSelect: () => copy(location.href.split('#')[0] ?? location.href, labels),
    },
    { type: 'separator' },
    {
      id: 'back',
      label: labels.back,
      icon: icons.back,
      shortcut: 'Alt+←',
      disabled: history.length < 2,
      onSelect: () => history.back(),
    },
    {
      id: 'reload',
      label: labels.reload,
      icon: icons.reload,
      shortcut: 'Ctrl+R',
      onSelect: () => location.reload(),
    },
  ];

  return context.length ? [...context, { type: 'separator' }, ...page] : page;
}

let unbind: (() => void) | undefined;

/** The public site's right-click menu. Safe to call once; inputs and the editor keep the native menu. */
export function initSiteMenu(): void {
  if (unbind) return;
  const labels = readLabels();
  if (!labels) return;
  unbind = bindContextMenu(document, (target) => resolve(target, readLabels() ?? labels), {
    label: labels.label,
  });
}

import svgPanZoom from 'svg-pan-zoom';

/** Interactive Mermaid diagrams: rendering by `mermaid`, pan/zoom by `svg-pan-zoom`. Loaded lazily, only on pages that have one. */
interface Labels {
  zoomIn: string;
  zoomOut: string;
  reset: string;
  fullscreen: string;
  exitFullscreen: string;
  copy: string;
  download: string;
  error: string;
  copied: string;
}
const DEFAULTS: Labels = {
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Reset view',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  copy: 'Copy diagram source',
  download: 'Download SVG',
  error: 'This diagram could not be rendered.',
  copied: 'Copied',
};

function labels(): Labels {
  try {
    return {
      ...DEFAULTS,
      ...(JSON.parse(
        document.getElementById('diagram-labels')?.textContent ?? '{}',
      ) as Partial<Labels>),
    };
  } catch {
    return DEFAULTS;
  }
}

const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>'),
  full: svg(
    '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  ),
  exit: svg(
    '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  ),
  copy: svg(
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  ),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
};

type Mermaid = typeof import('mermaid')['default'];
let mermaidPromise: Promise<Mermaid> | undefined;
let initializedFor = '';
let counter = 0;
/** source + theme → rendered SVG, so editing one diagram does not re-render the others on every keystroke. */
const cache = new Map<string, string>();
const instances = new WeakMap<HTMLElement, ReturnType<typeof svgPanZoom>>();

const currentTheme = (): 'dark' | 'light' =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

async function engine(theme: 'dark' | 'light'): Promise<Mermaid> {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  const mermaid = await mermaidPromise;
  if (initializedFor !== theme) {
    const dark = theme === 'dark';
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict', // diagram text is untrusted: no scripts, no HTML labels
      theme: 'base',
      fontFamily: "'Bricolage Grotesque Variable','Vazirmatn Variable',system-ui,sans-serif",
      themeVariables: dark
        ? {
            background: '#111113',
            primaryColor: '#1b1b1f',
            primaryTextColor: '#ecece6',
            primaryBorderColor: '#d4ff3a',
            lineColor: '#85857f',
            secondaryColor: '#232326',
            tertiaryColor: '#111113',
            textColor: '#ecece6',
            noteBkgColor: '#232326',
            noteTextColor: '#ecece6',
          }
        : {
            background: '#e8e7df',
            primaryColor: '#ffffff',
            primaryTextColor: '#0d0d0e',
            primaryBorderColor: '#2a3bff',
            lineColor: '#6d6d66',
            secondaryColor: '#f1f0ea',
            tertiaryColor: '#e8e7df',
            textColor: '#0d0d0e',
            noteBkgColor: '#f1f0ea',
            noteTextColor: '#0d0d0e',
          },
    });
    initializedFor = theme;
  }
  return mermaid;
}

function button(title: string, icon: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mm-btn';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = icon;
  b.addEventListener('click', onClick);
  return b;
}

function enhance(block: HTMLElement, source: string, markup: string, l: Labels): void {
  block.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'mm-view';
  view.innerHTML = markup; // SVG produced by mermaid with securityLevel "strict" (sanitised)
  const el = view.querySelector('svg');
  if (!el) return;
  el.removeAttribute('height');
  el.style.maxWidth = 'none';
  el.setAttribute('width', '100%');
  el.setAttribute('height', '100%');
  el.setAttribute('role', 'img');

  const bar = document.createElement('div');
  bar.className = 'mm-bar';
  bar.setAttribute('role', 'toolbar');
  const full = button(l.fullscreen, ICON.full, () => {
    const on = block.classList.toggle('is-full');
    full.innerHTML = on ? ICON.exit : ICON.full;
    full.title = on ? l.exitFullscreen : l.fullscreen;
    full.setAttribute('aria-label', full.title);
    document.documentElement.classList.toggle('mm-lock', on);
    const pz = instances.get(block);
    requestAnimationFrame(() => {
      pz?.resize();
      pz?.fit();
      pz?.center();
    });
  });
  bar.append(
    button(l.zoomIn, ICON.plus, () => instances.get(block)?.zoomIn()),
    button(l.zoomOut, ICON.minus, () => instances.get(block)?.zoomOut()),
    button(l.reset, ICON.reset, () => {
      const pz = instances.get(block);
      pz?.resetZoom();
      pz?.fit();
      pz?.center();
    }),
    button(l.copy, ICON.copy, () => {
      void navigator.clipboard?.writeText(source).catch(() => {});
      flash(block, l.copied);
    }),
    button(l.download, ICON.download, () => {
      const blob = new Blob([markup], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'diagram.svg';
      a.click();
      URL.revokeObjectURL(a.href);
    }),
    full,
  );
  block.append(bar, view);

  const pz = svgPanZoom(el, {
    zoomEnabled: true,
    panEnabled: true,
    controlIconsEnabled: false,
    dblClickZoomEnabled: true,
    mouseWheelZoomEnabled: false, // the wheel keeps scrolling the article; Ctrl/⌘ + wheel zooms (below)
    preventMouseEventsDefault: true,
    fit: true,
    center: true,
    minZoom: 0.2,
    maxZoom: 14,
    zoomScaleSensitivity: 0.3,
  });
  instances.set(block, pz);
  // while Ctrl/⌘ is held over a diagram the page must not scroll under it: lock the root (the scrollbar gutter is reserved so nothing shifts)
  const setLock = (on: boolean) => {
    if (!block.classList.contains('is-full'))
      document.documentElement.classList.toggle('mm-lock', on);
  };
  view.addEventListener('pointerenter', (e) => setLock(e.ctrlKey || e.metaKey));
  view.addEventListener('pointerleave', () => setLock(false));
  view.addEventListener('pointermove', (e) => setLock(e.ctrlKey || e.metaKey));
  view.addEventListener('wheel', (e) => (e.ctrlKey || e.metaKey) && e.preventDefault(), {
    passive: false,
    capture: true,
  });
  view.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey) && !block.classList.contains('is-full')) return;
      e.preventDefault();
      if (e.deltaY < 0) pz.zoomIn();
      else pz.zoomOut();
    },
    { passive: false },
  );
}

function flash(block: HTMLElement, text: string): void {
  let tip = block.querySelector<HTMLElement>('.mm-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'mm-tip';
    block.append(tip);
  }
  tip.textContent = text;
  tip.classList.add('on');
  setTimeout(() => tip?.classList.remove('on'), 1200);
}

async function renderBlock(block: HTMLElement, l: Labels, theme: 'dark' | 'light'): Promise<void> {
  const source = (
    block.dataset.source ??
    block.querySelector('.mermaid-src')?.textContent ??
    ''
  ).trim();
  block.dataset.source = source;
  const key = `${theme}\0${source}`;
  try {
    let markup = cache.get(key);
    if (!markup) {
      const mermaid = await engine(theme);
      markup = (await mermaid.render(`mm-${++counter}`, source)).svg;
      cache.set(key, markup);
      if (cache.size > 60) cache.delete(cache.keys().next().value as string);
    }
    enhance(block, source, markup, l);
    block.dataset.done = theme;
  } catch (err) {
    // mermaid leaves a half-built error node in the body; remove it
    for (const n of document.querySelectorAll('[id^="dmm-"]')) n.remove();
    console.warn('[mermaid]', err instanceof Error ? err.message : err);
    block.dataset.done = 'error';
    block.classList.add('mm-error');
    block.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'mm-errmsg';
    msg.textContent = l.error;
    const pre = document.createElement('pre');
    pre.className = 'mermaid-src';
    pre.textContent = source;
    block.append(msg, pre);
  }
}

/** Renders every un-rendered `.mermaid-block` under `root` (also called from the admin preview). */
export async function renderMermaidIn(root: ParentNode = document): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('.mermaid-block:not([data-done])')];
  if (!blocks.length) return;
  const l = labels();
  const theme = currentTheme();
  await Promise.all(blocks.map((b) => renderBlock(b, l, theme)));
}

let watching = false;
/** Re-render diagrams when the site theme flips; Esc leaves full screen. */
export function watchMermaid(): void {
  if (watching) return;
  watching = true;
  new MutationObserver(async () => {
    const theme = currentTheme();
    const stale = [...document.querySelectorAll<HTMLElement>('.mermaid-block[data-done]')].filter(
      (b) => b.dataset.done !== theme && b.dataset.done !== 'error',
    );
    const l = labels();
    await Promise.all(stale.map((b) => renderBlock(b, l, theme)));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const full = document.querySelector<HTMLElement>('.mermaid-block.is-full');
    full
      ?.querySelector<HTMLButtonElement>('.mm-btn[aria-label="' + labels().exitFullscreen + '"]')
      ?.click();
  });
}

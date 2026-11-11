const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/** Small trusted icon set (Lucide-style strokes) for menu items. */
export const icons = {
  external: svg(
    '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  ),
  open: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  link: svg(
    '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  ),
  copy: svg(
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  ),
  cut: svg(
    '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  ),
  paste: svg(
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  ),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  back: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  forward: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  reload: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>'),
  theme: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ),
  globe: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  ),
  home: svg('<path d="m3 11 9-8 9 8M5 10v10h14V10"/>'),
  edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  trash: svg(
    '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  ),
  eye: svg(
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  ),
  eyeOff: svg(
    '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a10 10 0 0 0 5.4-1.6M2 2l20 20"/>',
  ),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  bold: svg('<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>'),
  italic: svg('<path d="M19 4h-9M14 20H5M15 4 9 20"/>'),
  code: svg('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),
  heading: svg('<path d="M6 4v16M18 4v16M6 12h12"/>'),
  quote: svg('<path d="M3 21c3 0 7-1 7-8V5H4v6h4M14 21c3 0 7-1 7-8V5h-6v6h4"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  image: svg(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  ),
  select: svg('<path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3"/>'),
} as const;

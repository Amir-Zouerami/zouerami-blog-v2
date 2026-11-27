/**
 * Icons for a project's highlight number. Each is the path data of a 24×24 outline drawing, so the admin picker and the
 * project page draw exactly the same thing. The key is what gets stored.
 */
export const METRIC_ICONS = {
  star: ['Stars', 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z'],
  fork: [
    'Forks',
    'M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 8.5v1a2.5 2.5 0 0 0 2.5 2.5h7a2.5 2.5 0 0 0 2.5-2.5v-1M12 12v3.5',
  ],
  download: ['Downloads', 'M12 3v12M7 10l5 5 5-5M4 20h16'],
  users: [
    'Users',
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  ],
  heart: ['Likes', 'M12 20s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.1-8 11-8 11z'],
  eye: [
    'Views',
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  rocket: [
    'Launches',
    'M12 15l-3-3c1.5-5 5-8.5 11-9-.5 6-4 9.5-9 11zM9 12H4l3-4h4M12 15v5l4-3v-4M6.5 15.5c-1.5.5-2.5 2-2.5 4.5 2.5 0 4-1 4.5-2.5',
  ],
  bolt: ['Speed', 'M13 2L4 14h7l-1 8 9-12h-7z'],
  package: ['Packages', 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9'],
  code: ['Code', 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16'],
  commit: ['Commits', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 12h6M16 12h6'],
  globe: [
    'Countries',
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  ],
  clock: ['Time', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2'],
  server: ['Servers', 'M4 4h16v7H4zM4 13h16v7H4zM8 7.5h.01M8 16.5h.01'],
  database: [
    'Data',
    'M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8zM4 5.5v13C4 19.9 7.6 21 12 21s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5',
  ],
  growth: ['Growth', 'M3 17l6-6 4 4 8-8M15 7h6v6'],
  check: ['Done', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.8 2.8L16 9.5'],
  message: ['Messages', 'M4 4h16v12H10l-6 4z'],
  shield: ['Security', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4'],
  trophy: [
    'Awards',
    'M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 20h8M10 18h4',
  ],
  fire: [
    'Popular',
    'M12 21c-3.9 0-7-2.7-7-6.5 0-4.5 4.5-6 4-11.5 3.5 2 5 5 5 7.5 1-.5 1.7-1.5 2-2.5 2 2 3 4.2 3 6.5 0 3.8-3.1 6.5-7 6.5z',
  ],
} as const satisfies Record<string, readonly [label: string, path: string]>;

export type MetricIcon = keyof typeof METRIC_ICONS;

/** Label and path of a stored icon name, or null when there is none (or it is unknown). */
export function metricIcon(name: string | undefined): { label: string; path: string } | null {
  if (!name || !Object.hasOwn(METRIC_ICONS, name)) return null;
  const [label, path] = METRIC_ICONS[name as MetricIcon];
  return { label, path };
}

/** Absolute URL for a site path. `site` is an origin with or without a trailing slash. */
export const absoluteUrl = (site: string, path: string): string =>
  `${site.replace(/\/$/, '')}${path}`;

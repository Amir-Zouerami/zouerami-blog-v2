/** Name shown on the wipe overlay for the page we are navigating to. */
export function destinationLabel(url: URL): string {
  const path = url.pathname.replace(/^\/fa(?=\/|$)/, '') || '/';
  if (path === '/') return 'Home';
  if (path.startsWith('/blog')) return 'Blog';
  if (path.startsWith('/work')) return 'Work';
  if (path.startsWith('/about')) return 'About';
  return 'zouerami';
}

export function shouldAnimate(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

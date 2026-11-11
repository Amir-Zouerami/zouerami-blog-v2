/**
 * Per-page behaviour under Astro's client router: `onPage(setup)` runs `setup` on every page load and
 * runs the cleanup it returns (listeners, observers) before the next page swaps in, so nothing accumulates.
 */
export function onPage(setup: (signal: AbortSignal) => unknown): void {
  let ctl: AbortController | undefined;
  let cleanup: unknown;
  const teardown = () => {
    ctl?.abort();
    if (typeof cleanup === 'function') cleanup();
    ctl = undefined;
    cleanup = undefined;
  };
  document.addEventListener('astro:before-swap', teardown);
  document.addEventListener('astro:page-load', () => {
    teardown();
    ctl = new AbortController();
    cleanup = setup(ctl.signal);
  });
}

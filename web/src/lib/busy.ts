/**
 * The one "working on it" state for anything that talks to the server: `data-busy` draws a spinner (styles/ui.css).
 */

/** A spinner that appears for a few milliseconds reads as a flicker: keep it on screen at least this long. */
const MIN_MS = 450;

/**
 * Marks a button (or other element) busy and returns the function that releases it. A busy button is disabled, so a
 * second click or Enter does nothing. Call the release without awaiting when the page is about to navigate away.
 */
export function busy(el: HTMLElement | null | undefined): () => Promise<void> {
  if (!el) return async () => {};
  const started = Date.now();
  const button = el instanceof HTMLButtonElement ? el : null;
  const wasDisabled = button?.disabled ?? false;
  el.dataset.busy = '';
  el.setAttribute('aria-busy', 'true');
  if (button) button.disabled = true;
  return async () => {
    const left = MIN_MS - (Date.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    delete el.dataset.busy;
    el.removeAttribute('aria-busy');
    if (button) button.disabled = wasDisabled;
  };
}

/** While a form is being sent its fields cannot be edited (they stay readable and are still part of the form). */
export function lockFields(form: HTMLFormElement): () => void {
  const fields = [...form.querySelectorAll<HTMLInputElement>('input:not([readonly]), textarea')];
  for (const f of fields) f.readOnly = true;
  return () => {
    for (const f of fields) f.readOnly = false;
  };
}

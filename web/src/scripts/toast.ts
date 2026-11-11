let timer: ReturnType<typeof setTimeout> | undefined;

/** Shows a short message in the layout's #toast element. */
export function showToast(text: string, ms = 1800): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), ms);
}

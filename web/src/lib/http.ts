export function hasControl(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) < 32) return true;
  return false;
}

/** Removes control characters and angle brackets from user-supplied display text. */
export function cleanText(s: string): string {
  let out = '';
  for (const ch of s) if (ch.charCodeAt(0) >= 32 && ch !== '<' && ch !== '>') out += ch;
  return out.trim();
}

/** Only same-site relative paths are allowed as post-login redirects (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (hasControl(next)) return fallback;
  return next;
}

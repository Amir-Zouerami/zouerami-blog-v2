/**
 * Text fragments (`#:~:text=…`): a link that scrolls to and highlights a passage. Chrome, Edge, Safari and
 * Firefox implement it natively, so sharing a quote needs no code on the receiving page.
 */
const MAX_FULL = 300;
const EDGE_WORDS = 6;

/** Percent-encoding with the characters that are syntax inside a text directive (`-`, `,`, `&`) also encoded. */
const enc = (s: string): string => encodeURIComponent(s).replace(/-/g, '%2D');

/** Whitespace-normalised selection, or '' when it is too short to be a useful quote. */
export function cleanQuote(selection: string): string {
  const s = selection.replace(/\s+/g, ' ').trim();
  return s.length < 3 ? '' : s;
}

/**
 * `#:~:text=<quote>` for short passages; for long ones the "start,end" form (first and last words), which is
 * how browsers themselves share long selections.
 */
export function textFragment(selection: string): string {
  const q = cleanQuote(selection);
  if (!q) return '';
  if (q.length <= MAX_FULL) return `#:~:text=${enc(q)}`;
  const words = q.split(' ');
  return `#:~:text=${enc(words.slice(0, EDGE_WORDS).join(' '))},${enc(words.slice(-EDGE_WORDS).join(' '))}`;
}

/** The page URL (without any existing hash) plus the fragment for the quote. */
export function quoteLink(pageUrl: string, selection: string): string {
  const frag = textFragment(selection);
  const base = pageUrl.split('#')[0] ?? pageUrl;
  return frag ? `${base}${frag}` : base;
}

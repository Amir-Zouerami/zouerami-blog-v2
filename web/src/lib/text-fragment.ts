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

const WORD = /[\p{L}\p{N}]/u;

/**
 * The selected text widened to whole words. Browsers only match a text fragment that starts and ends on word
 * boundaries, so a selection that begins or ends inside a word ("aller promises…") would silently not link anywhere.
 */
export function selectionQuote(sel: Selection | null): string {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';
  const range = sel.getRangeAt(0).cloneRange();
  const grow = (node: Node, offset: number, dir: -1 | 1): number => {
    if (node.nodeType !== Node.TEXT_NODE) return offset;
    const t = node.textContent ?? '';
    let i = offset;
    while (dir < 0 ? i > 0 && WORD.test(t[i - 1] ?? '') : i < t.length && WORD.test(t[i] ?? ''))
      i += dir;
    return i;
  };
  const hadStartInWord = (() => {
    const t = range.startContainer.textContent ?? '';
    return (
      range.startContainer.nodeType === Node.TEXT_NODE && WORD.test(t[range.startOffset - 1] ?? '')
    );
  })();
  if (hadStartInWord)
    range.setStart(range.startContainer, grow(range.startContainer, range.startOffset, -1));
  range.setEnd(range.endContainer, grow(range.endContainer, range.endOffset, 1));
  return cleanQuote(range.toString());
}

/** Reads the quote out of a `#:~:text=` URL: [start] or [start, end]. */
export function fragmentParts(url: string): string[] | null {
  const m = /#(?:[^#]*?):~:text=([^&]+)/.exec(url);
  if (!m?.[1]) return null;
  try {
    return m[1]
      .split(',')
      .map((p) => decodeURIComponent(p))
      .filter(Boolean);
  } catch {
    return null;
  }
}

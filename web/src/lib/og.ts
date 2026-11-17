import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

export type OgLang = 'en' | 'fa';
export interface OgInput {
  title: string;
  lang: OgLang;
  /** e.g. formatted date */
  meta?: string;
  tags?: string[];
}

// Resolved from the working directory (web/ in dev and tests, /app in the container): import.meta.url
// points into the bundled chunks after `astro build`, so it cannot locate the font files.
const font = (f: string) => join(process.cwd(), 'assets', 'og', f);
const FONT_FILES = [
  'Vazirmatn-arabic.ttf',
  'Vazirmatn-latin.ttf',
  'Bricolage-latin.ttf',
  'InstrumentSerif-Italic.ttf',
].map(font);

/** Forces right-to-left ordering for a line (resvg ignores the paragraph direction attribute). */
export const rtlIsolate = (s: string): string => `\u2067${s}\u2069`;

export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/** Greedy word wrap by estimated glyph width (resvg has no auto-wrap). Never returns more than maxLines. */
export function wrapTitle(
  title: string,
  lang: OgLang,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const unit = fontSize * (lang === 'fa' ? 0.52 : 0.56);
  const maxChars = Math.max(8, Math.floor(maxWidth / unit));
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${(kept[maxLines - 1] ?? '').replace(/[\s.,;:!?،؛]+$/, '')}…`;
    return kept;
  }
  return lines;
}

export function ogSvg({ title, lang, meta, tags = [] }: OgInput): string {
  const rtl = lang === 'fa';
  const W = 1200;
  const H = 630;
  const pad = 72;
  const size = title.length > 70 ? 60 : title.length > 40 ? 72 : 88;
  const lines = wrapTitle(title, lang, size, W - pad * 2, 4);
  const family = rtl ? "'Vazirmatn'" : "'Bricolage Grotesque 96pt ExtraBold'";
  const x = rtl ? W - pad : pad;
  const anchor = rtl ? 'end' : 'start';
  const lineH = size * (rtl ? 1.45 : 1.08);
  const top = 250;
  const text = lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${top + i * lineH}" font-family="${family}" font-size="${size}" font-weight="400" fill="#ecece6" text-anchor="${anchor}" direction="${rtl ? 'rtl' : 'ltr'}" unicode-bidi="plaintext">${esc(rtl ? rtlIsolate(l) : l)}</text>`,
    )
    .join('');
  const foot = [meta, ...tags.slice(0, 3)].filter(Boolean).join('   ·   ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#0a0a0b"/>
${Array.from({ length: 11 }, (_, i) => `<rect x="${((i + 1) * W) / 12}" y="0" width="1" height="${H}" fill="#232326"/>`).join('')}
<circle cx="${rtl ? 150 : W - 150}" cy="150" r="260" fill="#d4ff3a" opacity=".07"/>
<text x="${pad}" y="104" font-family="'Bricolage Grotesque 96pt ExtraBold'" font-size="40" font-weight="400" fill="#ecece6">zouerami<tspan fill="#d4ff3a" font-size="22" dy="-14">®</tspan></text>
<rect x="${rtl ? W - pad - 120 : pad}" y="140" width="120" height="6" fill="#d4ff3a"/>
${text}
<text x="${x}" y="${H - 64}" font-family="${rtl ? "'Vazirmatn'" : "'Bricolage Grotesque 96pt ExtraBold'"}" font-size="30" fill="#85857f" text-anchor="${anchor}" direction="${rtl ? 'rtl' : 'ltr'}" unicode-bidi="plaintext">${esc(rtl ? rtlIsolate(foot) : foot)}</text>
<text x="${rtl ? pad : W - pad}" y="${H - 64}" font-family="'Bricolage Grotesque 96pt ExtraBold'" font-size="30" fill="#d4ff3a" text-anchor="${rtl ? 'start' : 'end'}">amir-zouerami.dev</text>
</svg>`;
}

/** 1200×630 PNG. resvg shapes Arabic-script text (rustybuzz), which Satori could not be relied on for. */
export function renderOg(input: OgInput): Uint8Array {
  const resvg = new Resvg(ogSvg(input), {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'Bricolage Grotesque 96pt ExtraBold',
    },
    fitTo: { mode: 'width', value: 1200 },
  });
  return resvg.render().asPng();
}

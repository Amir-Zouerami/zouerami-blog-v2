import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPY, EMAIL_KINDS, renderEmail, renderText } from '../../scripts/emails/design';

const hooksDir = join(import.meta.dirname, '../../../pocketbase/pb_hooks/emails');

describe.each(EMAIL_KINDS)('email: %s', (kind) => {
  const html = renderEmail(kind);

  it('is English, left-to-right (no Persian templates)', () => {
    expect(html).toContain('<html lang="en" dir="ltr"');
    expect(html).not.toMatch(/[؀-ۿ]/);
  });
  it('has one primary action link with the {{URL}} placeholder, plus the plain-link fallback', () => {
    expect(html.match(/\{\{URL\}\}/g)?.length).toBe(3); // button href, fallback href, fallback text
    expect(html).toContain('{{SITE}}');
    expect(html).toContain(COPY[kind].button);
  });
  it('is email-safe: no scripts, no external assets, no web fonts, inline styles', () => {
    expect(html).not.toMatch(/<script|<link |@import|@font-face|url\(|<img /i);
    expect(html).toContain('role="presentation"');
    expect(html).toMatch(/style="[^"]*background:#0a0a0b/);
  });
  it('carries the inbox preview text and a plain-text twin', () => {
    expect(html).toContain(COPY[kind].preheader);
    const text = renderText(kind);
    expect(text).toContain('{{URL}}');
    expect(text).not.toContain('<');
  });
  it('the committed PocketBase template files are in sync with the design (run `bun run build:emails`)', () => {
    expect(readFileSync(join(hooksDir, `${kind}.html`), 'utf8')).toBe(html);
    expect(readFileSync(join(hooksDir, `${kind}.txt`), 'utf8')).toBe(renderText(kind));
  });
});

describe('copy', () => {
  it('escapes markup in text', () => {
    expect(renderEmail('verify')).not.toContain('<script');
  });
  it('subjects match what the PocketBase hooks send', () => {
    const lib = readFileSync(
      join(import.meta.dirname, '../../../pocketbase/pb_hooks/lib/mail.js'),
      'utf8',
    );
    for (const kind of EMAIL_KINDS) expect(lib).toContain(COPY[kind].subject);
  });
});

import { describe, expect, it } from 'vitest';
import { cleanQuote, quoteLink, textFragment } from '../../src/lib/text-fragment';

describe('text fragments', () => {
  it('encodes a short quote', () => {
    expect(textFragment('Hello, world & more')).toBe('#:~:text=Hello%2C%20world%20%26%20more');
  });
  it('encodes the directive syntax characters - , &', () => {
    expect(textFragment('state-of-the-art')).toBe('#:~:text=state%2Dof%2Dthe%2Dart');
  });
  it('collapses whitespace and newlines from multi-paragraph selections', () => {
    expect(textFragment('one\n\n  two\tthree')).toBe('#:~:text=one%20two%20three');
  });
  it('uses start,end for long selections', () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const f = textFragment(long);
    expect(f.startsWith('#:~:text=word0%20word1')).toBe(true);
    expect(f).toContain(',');
    expect(f.endsWith('word79')).toBe(true);
    expect(f.length).toBeLessThan(200);
  });
  it('handles Persian text', () => {
    expect(decodeURIComponent(textFragment('سلام دنیا'))).toBe('#:~:text=سلام دنیا');
  });
  it('rejects selections that are too short to share', () => {
    expect(textFragment('  a ')).toBe('');
    expect(cleanQuote('ab')).toBe('');
  });
  it('builds a link without an existing hash', () => {
    expect(quoteLink('http://x/blog/a#section', 'hello there')).toBe(
      'http://x/blog/a#:~:text=hello%20there',
    );
    expect(quoteLink('http://x/blog/a', 'x')).toBe('http://x/blog/a');
  });
});

import { fragmentParts } from '../../src/lib/text-fragment';

describe('fragmentParts', () => {
  it('reads one or two parts from a text-fragment URL', () => {
    expect(fragmentParts('http://x/a#:~:text=hello%20world')).toEqual(['hello world']);
    expect(fragmentParts('http://x/a#:~:text=start%20here,end%20there')).toEqual([
      'start here',
      'end there',
    ]);
    expect(fragmentParts('http://x/a')).toBeNull();
  });
});

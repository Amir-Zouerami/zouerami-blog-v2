const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * UUID version 7 (RFC 9562): 48-bit Unix-ms timestamp, then random bits. Sortable by creation time,
 * which makes trace ids easy to range-scan in logs. `now` is injectable for tests.
 */
export function uuidv7(
  now: number = Date.now(),
  random: (n: number) => Uint8Array = randomBytes,
): string {
  const b = random(16);
  b[0] = Math.floor(now / 2 ** 40) & 0xff;
  b[1] = Math.floor(now / 2 ** 32) & 0xff;
  b[2] = (now >>> 24) & 0xff;
  b[3] = (now >>> 16) & 0xff;
  b[4] = (now >>> 8) & 0xff;
  b[5] = now & 0xff;
  b[6] = ((b[6] as number) & 0x0f) | 0x70; // version 7
  b[8] = ((b[8] as number) & 0x3f) | 0x80; // RFC 4122 variant
  const h = (i: number) => HEX[b[i] as number];
  return `${h(0)}${h(1)}${h(2)}${h(3)}-${h(4)}${h(5)}-${h(6)}${h(7)}-${h(8)}${h(9)}-${h(10)}${h(11)}${h(12)}${h(13)}${h(14)}${h(15)}`;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s);

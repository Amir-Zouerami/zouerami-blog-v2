/**
 * Proof-of-work for the bot guard (see lib/guard.ts). Runs in the browser (in a Web Worker) and in tests.
 * `solve` looks for a counter n such that SHA-256(prefix + n) starts with `bits` zero bits. The prefix never
 * changes between attempts, so its full 64-byte blocks are hashed once and every attempt costs one compression.
 */
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]) as unknown as number[];
const IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const W = new Int32Array(64) as unknown as number[];

/** One SHA-256 compression: W[0..15] is the block, `h` the state (updated in place). */
function compress(h: number[]): void {
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15] as number;
    const b = W[i - 2] as number;
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = ((W[i - 16] as number) + s0 + (W[i - 7] as number) + s1) | 0;
  }
  let a = h[0] as number;
  let b = h[1] as number;
  let c = h[2] as number;
  let d = h[3] as number;
  let e = h[4] as number;
  let f = h[5] as number;
  let g = h[6] as number;
  let hh = h[7] as number;
  for (let i = 0; i < 64; i++) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (hh + s1 + ch + (K[i] as number) + (W[i] as number)) | 0;
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (s0 + maj) | 0;
    hh = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  h[0] = ((h[0] as number) + a) | 0;
  h[1] = ((h[1] as number) + b) | 0;
  h[2] = ((h[2] as number) + c) | 0;
  h[3] = ((h[3] as number) + d) | 0;
  h[4] = ((h[4] as number) + e) | 0;
  h[5] = ((h[5] as number) + f) | 0;
  h[6] = ((h[6] as number) + g) | 0;
  h[7] = ((h[7] as number) + hh) | 0;
}

/** Number of leading zero bits of a hash given as eight 32-bit words. */
export function zeroBits(h: number[]): number {
  let n = 0;
  for (let i = 0; i < 8; i++) {
    const w = h[i] as number;
    if (w === 0) {
      n += 32;
      continue;
    }
    return n + Math.clz32(w);
  }
  return n;
}

function loadWords(block: Uint8Array): void {
  for (let i = 0; i < 16; i++) {
    const j = i * 4;
    W[i] =
      ((block[j] as number) << 24) |
      ((block[j + 1] as number) << 16) |
      ((block[j + 2] as number) << 8) |
      (block[j + 3] as number);
  }
}

/**
 * Tries counters `from` ... `from + count - 1` and returns the first one that works, or -1.
 * `prefix` must be ASCII (the guard challenge plus ":").
 */
export function solve(
  prefix: string,
  bits: number,
  from = 0,
  count = Number.POSITIVE_INFINITY,
): number {
  const pre = new Uint8Array(prefix.length);
  for (let i = 0; i < prefix.length; i++) pre[i] = prefix.charCodeAt(i) & 0x7f;
  const state = IV.slice();
  const full = Math.floor(pre.length / 64);
  for (let b = 0; b < full; b++) {
    loadWords(pre.subarray(b * 64, b * 64 + 64));
    compress(state);
  }
  const rest = pre.subarray(full * 64);
  const buf = new Uint8Array(64);
  const h = new Array<number>(8).fill(0);
  const end = from + count;
  for (let n = from; n < end; n++) {
    const digits = String(n);
    const len = rest.length + digits.length;
    if (len > 55) throw new Error('guard prefix too long');
    buf.fill(0);
    buf.set(rest, 0);
    for (let i = 0; i < digits.length; i++) buf[rest.length + i] = digits.charCodeAt(i);
    buf[len] = 0x80;
    const total = (pre.length + digits.length) * 8;
    buf[60] = (total >>> 24) & 0xff;
    buf[61] = (total >>> 16) & 0xff;
    buf[62] = (total >>> 8) & 0xff;
    buf[63] = total & 0xff;
    loadWords(buf);
    for (let i = 0; i < 8; i++) h[i] = state[i] as number;
    compress(h);
    if (zeroBits(h) >= bits) return n;
  }
  return -1;
}

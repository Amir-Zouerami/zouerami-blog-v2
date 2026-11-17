import { solve } from '../lib/sha256-pow';

/** Web Worker: finds the proof-of-work counter without freezing the page. */
self.onmessage = (e: MessageEvent<{ prefix: string; bits: number }>) => {
  const { prefix, bits } = e.data;
  const step = 20_000;
  for (let from = 0; ; from += step) {
    const n = solve(prefix, bits, from, step);
    if (n >= 0) {
      (self as unknown as Worker).postMessage(n);
      return;
    }
  }
};

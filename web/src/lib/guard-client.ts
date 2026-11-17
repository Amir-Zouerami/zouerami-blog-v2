import { api } from './client-api';
import { solve } from './sha256-pow';

function inWorker(prefix: string, bits: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../scripts/guard-worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<number>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e);
    };
    worker.postMessage({ prefix, bits });
  });
}

/** Fallback when workers are unavailable: same search on the main thread, yielding between chunks. */
async function inPage(prefix: string, bits: number): Promise<number> {
  for (let from = 0; ; from += 5_000) {
    const n = solve(prefix, bits, from, 5_000);
    if (n >= 0) return n;
    await new Promise((r) => setTimeout(r));
  }
}

/** Gets a challenge, solves it, and returns the value to send as `guard` (null when the server is unreachable). */
export async function guardToken(): Promise<string | null> {
  const res = await api<{ challenge: string; bits: number }>('/api/guard');
  if (!res.ok || !res.data) return null;
  const { challenge, bits } = res.data;
  const prefix = `${challenge}:`;
  const n = await inWorker(prefix, bits).catch(() => inPage(prefix, bits));
  return `${challenge}~${n}`;
}

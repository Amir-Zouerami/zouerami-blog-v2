import { useState } from 'react';

export default function Ping() {
  const [n, setN] = useState(0);
  return (
    <button
      type="button"
      className="rounded border px-3 py-1 font-mono text-sm"
      onClick={() => setN(n + 1)}
    >
      ok {n}
    </button>
  );
}

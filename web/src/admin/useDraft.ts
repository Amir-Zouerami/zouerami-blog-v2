import { useCallback, useEffect, useRef, useState } from 'react';

interface Stored<T> {
  value: T;
  at: number;
}

const PREFIX = 'adm-draft:';

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Stored<T>) : null;
  } catch {
    return null;
  }
}

/**
 * Keeps an unsaved copy of the form in localStorage (debounced) so a closed tab, crash or accidental
 * navigation never loses writing. `baseline` is the JSON of the last saved state: a stored copy equal to it
 * is not worth recovering. Returns the recoverable copy (if any) and helpers.
 */
export function useDraft<T>(
  key: string,
  value: T,
  opts: { baseline: string | null; enabled: boolean },
) {
  const [recoverable, setRecoverable] = useState<Stored<T> | null>(null);
  const checked = useRef(false);

  // once the saved state is known, look for a different stored copy
  useEffect(() => {
    if (opts.baseline === null || checked.current) return;
    checked.current = true;
    const stored = read<T>(key);
    if (stored && JSON.stringify(stored.value) !== opts.baseline) setRecoverable(stored);
  }, [key, opts.baseline]);

  const json = JSON.stringify(value);
  useEffect(() => {
    // do not overwrite a recoverable copy until the user has decided
    if (!opts.enabled || recoverable || opts.baseline === null) return;
    const t = setTimeout(() => {
      try {
        if (json === opts.baseline) localStorage.removeItem(PREFIX + key);
        else
          localStorage.setItem(
            PREFIX + key,
            JSON.stringify({ value: JSON.parse(json), at: Date.now() }),
          );
      } catch {
        /* storage full or blocked: editing still works */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [json, key, opts.enabled, opts.baseline, recoverable]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return {
    recoverable,
    /** Hand back the stored value and stop offering it. */
    take(): T | null {
      const v = recoverable?.value ?? null;
      setRecoverable(null);
      return v;
    },
    discard() {
      clear();
      setRecoverable(null);
    },
    clear,
  };
}

import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

type Toast = { id: number; text: string; kind: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'err' ? 7000 : 2500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`adm-toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label className="adm-field">
      <span className="mono muted">{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function Confirm({ message, onYes }: { message: string; onYes: () => void }) {
  return (
    <button
      type="button"
      className="adm-btn danger"
      onClick={() => {
        if (confirm(message)) onYes();
      }}
    >
      Delete
    </button>
  );
}

export function useAsync<T>() {
  const [state, set] = useState<{ loading: boolean; error: string; data: T | null }>({
    loading: true,
    error: '',
    data: null,
  });
  return [state, set] as const;
}

export const fmtDate = (s: string) =>
  s
    ? new Date(s.replace(' ', 'T')).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

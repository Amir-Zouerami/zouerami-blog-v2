import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '../ui/Button';

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

/** Labelled form row. `group` is for rows holding several controls (buttons, links), where a wrapping <label> would give them the wrong accessible name. */
export function Field({
  label,
  children,
  hint,
  group = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  group?: boolean;
}) {
  const inner = (
    <>
      <span className="mono muted">{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </>
  );
  if (group) {
    return (
      <fieldset className="adm-field">
        <legend className="mono muted">{label}</legend>
        {children}
        {hint && <small className="muted">{hint}</small>}
      </fieldset>
    );
  }
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label className="adm-field">{inner}</label>
  );
}

export function Confirm({ message, onYes }: { message: string; onYes: () => void }) {
  return (
    <Button
      variant="danger"
      onClick={() => {
        if (confirm(message)) onYes();
      }}
    >
      Delete
    </Button>
  );
}

export const fmtDate = (s: string) =>
  s
    ? new Date(s.replace(' ', 'T')).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

/** Ctrl/Cmd+S saves from anywhere on the page (any field, or none) instead of opening the browser's "save page" dialog. */
export function useSaveShortcut(save: () => void) {
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.code !== 'KeyS') return;
      e.preventDefault();
      if (!e.repeat) latest.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

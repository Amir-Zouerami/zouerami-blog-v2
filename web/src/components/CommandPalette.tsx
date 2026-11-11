import { useCallback, useEffect, useRef, useState } from 'react';
import { type Command, filterCommands, STATIC_COMMANDS } from '../lib/commands';
import { applyTheme } from '../lib/theme';

type Hit = { title: string; slug: string; summary: string };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searchError, setSearchError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const prev = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    prev.current?.focus();
  }, []);

  useEffect(() => {
    const openIt = () => {
      prev.current = document.activeElement as HTMLElement | null;
      setQ('');
      setSel(0);
      setOpen(true);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (!o) prev.current = document.activeElement as HTMLElement | null;
          return !o;
        });
      }
    };
    window.addEventListener('palette:open', openIt);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('palette:open', openIt);
      window.removeEventListener('keydown', key);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    setSearchError(false);
    if (!open || q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, {
          signal: ctl.signal,
        });
        if (!r.ok) throw new Error(String(r.status));
        setHits(((await r.json()) as { results: Hit[] }).results);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setHits([]);
          setSearchError(true);
        }
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, open]);

  const items: (Command & { custom?: true })[] = [
    ...filterCommands(STATIC_COMMANDS, q),
    ...hits.map((h) => ({
      id: `post-${h.slug}`,
      label: h.title,
      hint: 'post',
      href: `/blog/${h.slug}`,
    })),
  ];

  const run = (c: Command) => {
    close();
    if (c.run === 'toggle-theme') {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    } else if (c.href) {
      void import('astro:transitions/client').then(({ navigate }) => navigate(c.href as string));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return close();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => (items.length ? (s + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => (items.length ? (s - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[sel]) {
      run(items[sel]);
    } else if (e.key === 'Tab') {
      // keep focus inside the dialog: the input is the only tab stop
      e.preventDefault();
      input.current?.focus();
    }
  };

  if (!open) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close; Escape handled on the dialog
    <div
      className="pal-bg on"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="pal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        ref={dialog}
        onKeyDown={onKey}
      >
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          placeholder="Type a command or search…"
          autoComplete="off"
          aria-label="Command"
        />
        <ul>
          {items.map((c, i) => (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions lint/a11y/useKeyWithClickEvents: keyboard handled on the dialog
            <li
              key={c.id}
              className={i === sel ? 'sel' : ''}
              onClick={() => run(c)}
              onMouseEnter={() => setSel(i)}
            >
              <span>{c.label}</span>
              <small>{c.hint}</small>
            </li>
          ))}
          {searchError && (
            <li role="status">
              <span className="muted">Search unavailable</span>
            </li>
          )}
          {!items.length && !searchError && (
            <li>
              <span className="muted">—</span>
            </li>
          )}
        </ul>
        <div className="pal-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Select } from '../ui/Select';
import {
  display,
  formatLocal,
  MONTHS,
  monthGrid,
  nowParts,
  type Parts,
  parseLocal,
  WEEKDAYS,
} from './date';

interface Props {
  /** `YYYY-MM-DD` (or `YYYY-MM-DDTHH:mm` with `withTime`); empty string = no date. */
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  label: string;
  placeholder?: string;
  clearable?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Calendar popover with an optional time selector. Keyboard: Esc closes, arrows move between days. */
export default function DateTimePicker({
  value,
  onChange,
  withTime = false,
  label,
  placeholder = 'Pick a date',
  clearable = false,
}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const parsed = parseLocal(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({
    year: (parsed ?? nowParts()).year,
    month: (parsed ?? nowParts()).month,
  }));

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const grid = useMemo(() => monthGrid(view.year, view.month), [view]);
  const today = nowParts();
  const time = { hour: parsed?.hour ?? 12, minute: parsed?.minute ?? 0 };

  const commit = (p: Pick<Parts, 'year' | 'month' | 'day'>, t = time) =>
    onChange(formatLocal({ ...p, ...t }, withTime));
  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const onKeyDay = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next =
      e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-day]')[
        i + step
      ];
    next?.focus();
  };

  return (
    <div className="dtp" ref={root}>
      <button
        type="button"
        id={id}
        className="dtp-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${display(value, withTime) || 'none'}`}
        onClick={() => {
          if (!open && parsed) setView({ year: parsed.year, month: parsed.month });
          setOpen((o) => !o);
        }}
      >
        <span className={value ? '' : 'muted'}>{display(value, withTime) || placeholder}</span>
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>
      {clearable && value && (
        <button
          type="button"
          className="dtp-clear"
          aria-label={`Clear ${label}`}
          onClick={() => onChange('')}
        >
          ×
        </button>
      )}
      {open && (
        <div className="dtp-pop" role="dialog" aria-label={`${label} calendar`}>
          <div className="dtp-head">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
              ‹
            </button>
            <strong>
              {MONTHS[view.month]} {view.year}
            </strong>
            <button type="button" aria-label="Next month" onClick={() => shift(1)}>
              ›
            </button>
          </div>
          <div className="dtp-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="dtp-wd" aria-hidden="true">
                {w}
              </span>
            ))}
            {grid.map((c, i) => {
              const selected =
                parsed &&
                parsed.year === c.year &&
                parsed.month === c.month &&
                parsed.day === c.day;
              const isToday =
                today.year === c.year && today.month === c.month && today.day === c.day;
              return (
                <button
                  key={`${c.year}-${c.month}-${c.day}`}
                  type="button"
                  data-day
                  aria-pressed={!!selected}
                  aria-label={`${c.day} ${MONTHS[c.month]} ${c.year}`}
                  className={`dtp-day${c.inMonth ? '' : ' out'}${selected ? ' sel' : ''}${isToday ? ' today' : ''}`}
                  onKeyDown={(e) => onKeyDay(e, i)}
                  onClick={() => {
                    commit(c);
                    if (!withTime) setOpen(false);
                  }}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          {withTime && (
            <div className="dtp-time">
              <span className="mono muted">Time</span>
              <Select
                aria-label="Hour"
                value={time.hour}
                onChange={(e) =>
                  parsed && commit(parsed, { ...time, hour: Number(e.target.value) })
                }
                disabled={!parsed}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {pad(h)}
                  </option>
                ))}
              </Select>
              :
              <Select
                aria-label="Minute"
                value={time.minute}
                onChange={(e) =>
                  parsed && commit(parsed, { ...time, minute: Number(e.target.value) })
                }
                disabled={!parsed}
              >
                {Array.from({ length: 60 }, (_, m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="dtp-foot">
            <button
              type="button"
              onClick={() => {
                const n = nowParts();
                commit(n, { hour: n.hour, minute: n.minute });
                setView({ year: n.year, month: n.month });
                if (!withTime) setOpen(false);
              }}
            >
              {withTime ? 'Now' : 'Today'}
            </button>
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            <span className="grow" />
            <button type="button" className="dtp-done" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

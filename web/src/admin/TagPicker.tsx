import { useState } from 'react';

const SHOWN = 12;

/**
 * Existing tags as toggle chips under the tags field. Chosen tags come first (they are also in the field), typing in the field narrows the
 * rest, and a long list shows a dozen and then opens into a small scrolling box instead of pushing the page down.
 */
export default function TagPicker({
  all,
  selected,
  typing,
  onToggle,
  noun = 'tag',
  plural = 'tags',
}: {
  all: string[];
  selected: string[];
  /** the word being typed after the last comma */
  typing: string;
  onToggle: (tag: string) => void;
  /** what the chips are called */
  noun?: string;
  plural?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!all.length) return null;
  const q = typing.trim().toLowerCase();
  const chosen = all.filter((x) => selected.includes(x));
  const rest = all.filter((x) => !selected.includes(x) && (!q || x.toLowerCase().includes(q)));
  const list = [...chosen, ...rest];
  const shown = open ? list : list.slice(0, SHOWN);
  const hidden = list.length - shown.length;
  return (
    <div className="adm-tagpick-wrap">
      <div className={`adm-tagpick${open ? ' open' : ''}`}>
        {shown.map((x) => {
          const on = selected.includes(x);
          return (
            <button
              key={x}
              type="button"
              className={on ? 'on' : ''}
              aria-pressed={on}
              onClick={() => onToggle(x)}
            >
              {x}
            </button>
          );
        })}
        {!list.length && (
          <span className="mono muted">
            No {noun} matches “{typing.trim()}”
          </span>
        )}
      </div>
      {(hidden > 0 || open) && list.length > SHOWN && (
        <button type="button" className="adm-tagmore" onClick={() => setOpen((o) => !o)}>
          {open ? 'Show fewer' : `Show all ${list.length} ${plural}`}
        </button>
      )}
    </div>
  );
}

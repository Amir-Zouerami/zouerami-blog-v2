import DateTimePicker from './DateTimePicker';

interface Props {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  label?: string;
}

/** "From – To" calendar filter (inclusive days). Swaps the bounds if they end up reversed. */
export default function DateRange({ from, to, onChange, label = 'Date' }: Props) {
  const set = (next: { from: string; to: string }) =>
    onChange(next.from && next.to && next.from > next.to ? { from: next.to, to: next.from } : next);
  return (
    <fieldset className="dtp-range">
      <legend className="sr-only">{`${label} range`}</legend>
      <DateTimePicker
        label={`${label} from`}
        placeholder="From"
        value={from}
        onChange={(v) => set({ from: v, to })}
        clearable
      />
      <span className="muted">–</span>
      <DateTimePicker
        label={`${label} to`}
        placeholder="To"
        value={to}
        onChange={(v) => set({ from, to: v })}
        clearable
      />
    </fieldset>
  );
}

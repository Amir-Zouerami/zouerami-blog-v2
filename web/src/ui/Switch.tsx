import { useId } from 'react';
import { cx } from './cx';

/** An on/off switch (role="switch"), keyboard and screen-reader friendly. Use instead of a bare checkbox. */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('ui-switch-row', className)}>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="ui-switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="ui-switch-thumb" aria-hidden="true" />
      </button>
      <label htmlFor={id}>
        <span>{label}</span>
        {hint && (
          <small id={`${id}-hint`} className="muted">
            {hint}
          </small>
        )}
      </label>
    </div>
  );
}

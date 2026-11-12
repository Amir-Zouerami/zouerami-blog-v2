import type { SelectHTMLAttributes } from 'react';
import { cx } from './cx';

/** A native <select> (so it keeps keyboard, mobile pickers and a11y) with our look: no browser chrome, custom chevron. */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx('ui-select', className)}>
      <select {...rest}>{children}</select>
      <svg viewBox="0 0 12 8" aria-hidden="true">
        <path
          d="M1 1.5 6 6.5l5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

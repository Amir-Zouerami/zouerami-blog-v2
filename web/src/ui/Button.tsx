import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'ghost' | 'solid' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'lg';

interface Common {
  variant?: ButtonVariant;
  /** `sm` for tools and the back office, `lg` for calls to action on the public site. */
  size?: ButtonSize;
  children?: ReactNode;
}

/** The one button. Renders an <a> when given an `href`, a <button> otherwise. Styles live in styles/ui.css. */
export function buttonClass(
  variant: ButtonVariant = 'ghost',
  size: ButtonSize = 'sm',
  extra?: string,
) {
  return variant === 'link'
    ? cx('ui-link', extra)
    : cx(
        'ui-btn',
        size === 'lg' && 'ui-btn--lg',
        variant !== 'ghost' && `ui-btn--${variant}`,
        extra,
      );
}

export function Button(
  props: Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined },
): ReactNode;
export function Button(
  props: Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string },
): ReactNode;
export function Button({
  variant,
  size,
  className,
  children,
  ...rest
}: Common & (ButtonHTMLAttributes<HTMLButtonElement> | AnchorHTMLAttributes<HTMLAnchorElement>)) {
  const cls = buttonClass(variant, size, className);
  if ('href' in rest && rest.href !== undefined)
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  return (
    <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

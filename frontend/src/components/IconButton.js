import React from 'react';
import { iconSpinClass } from './LoadingButton';

/**
 * Icon-only action button — use `label` for aria-label and tooltip.
 */
export default function IconButton({
  icon: Icon,
  label,
  variant = 'secondary',
  size = 'md',
  active = false,
  loading = false,
  className = '',
  disabled,
  type = 'button',
  ...rest
}) {
  const variantClass =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
        ? 'btn-danger'
        : variant === 'ghost'
          ? 'btn-ghost'
          : 'btn-secondary';

  const classes = [
    'btn',
    'btn-icon',
    size === 'sm' ? 'btn-icon-sm' : '',
    variantClass,
    active ? 'is-active' : '',
    loading ? 'is-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Icon className={iconSpinClass(loading)} aria-hidden />
    </button>
  );
}

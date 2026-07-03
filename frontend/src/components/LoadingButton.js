import React from 'react';

/** Apply to any react-icons component while an action is in progress. */
export function iconSpinClass(loading) {
  return loading ? 'icon-spin' : undefined;
}

/**
 * Button with optional leading icon that spins while `loading` is true.
 * Pass `loadingLabel` to swap button text during loading; omit to keep the same label.
 */
export default function LoadingButton({
  loading = false,
  icon: Icon,
  children,
  className = 'btn',
  disabled,
  loadingLabel,
  type = 'button',
  ...rest
}) {
  const busy = Boolean(loading || disabled);
  const showLabel = loading && loadingLabel !== undefined ? loadingLabel : children;
  const classes = [className, loading ? 'is-loading' : ''].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={busy}
      aria-busy={loading || undefined}
      {...rest}
    >
      {Icon && <Icon className={iconSpinClass(loading)} aria-hidden />}
      {showLabel}
    </button>
  );
}

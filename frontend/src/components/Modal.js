import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Portal modal — renders at document.body so position:fixed is viewport-relative
 * (avoids misalignment from page transforms / depth layers).
 */
export default function Modal({
  open,
  onClose,
  children,
  overlayClassName = '',
  contentClassName = '',
  ariaLabel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const overlayClasses = ['modal-overlay', overlayClassName].filter(Boolean).join(' ');
  const contentClasses = ['modal-content', contentClassName].filter(Boolean).join(' ');

  return createPortal(
    <div className={overlayClasses} onClick={onClose} role="presentation">
      <div
        className={contentClasses}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

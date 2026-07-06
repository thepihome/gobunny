import React from 'react';
import './BrandLogo.css';

/**
 * GoDash by GoBunnyy — matches ipihome wordmark (Go = navy, rest = slate).
 * @param {'navbar' | 'auth' | 'compact'} variant
 */
const BrandLogo = ({ variant = 'navbar', className = '' }) => {
  const isCompact = variant === 'compact';

  return (
    <span className={`site-brand brand-logo brand-logo--${variant} ${className}`.trim()} aria-label="GoDash by GoBunnyy">
      <span className="brand-stack">
        <span className="brand-wordmark brand-wordmark--product">
          <span className="brand-go">Go</span>
          <span className="brand-rest">Dash</span>
        </span>
        {!isCompact && (
          <span className="brand-byline">
            by{' '}
            <span className="brand-wordmark brand-wordmark--parent">
              <span className="brand-go">Go</span>
              <span className="brand-rest">Bunnyy</span>
            </span>
          </span>
        )}
      </span>
    </span>
  );
};

export default BrandLogo;

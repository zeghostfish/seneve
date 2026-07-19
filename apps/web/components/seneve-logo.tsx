import * as React from 'react';

import { SENEVE_BRAND, logoPathForVariant, type SeneveLogoVariant } from '../lib/brand';

type SeneveLogoSize = 'sm' | 'md' | 'lg' | 'custom';

export interface SeneveLogoProps {
  readonly variant?: SeneveLogoVariant;
  readonly size?: SeneveLogoSize;
  readonly className?: string;
  readonly priority?: boolean;
  readonly alt?: string;
}

const logoSizes: Record<Exclude<SeneveLogoSize, 'custom'>, string> = {
  sm: 'h-7',
  md: 'h-10',
  lg: 'h-14',
};

const intrinsicSize = {
  transparent: { width: 2412, height: 644 },
  whiteBackground: { width: 2412, height: 644 },
  mark: { width: 528, height: 612 },
} satisfies Record<SeneveLogoVariant, { width: number; height: number }>;

export function SeneveLogo({
  variant = 'transparent',
  size = 'md',
  className,
  priority = false,
  alt = SENEVE_BRAND.name,
}: SeneveLogoProps) {
  const source = logoPathForVariant(variant);
  const dimensions = intrinsicSize[variant];
  const sizeClass = size === 'custom' ? '' : logoSizes[size];
  const classes = ['block w-auto shrink-0 object-contain', sizeClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      src={source}
      width={dimensions.width}
      height={dimensions.height}
      alt={alt}
      className={classes}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
    />
  );
}

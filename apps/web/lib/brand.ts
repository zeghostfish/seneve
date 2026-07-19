export const SENEVE_BRAND = {
  name: 'Seneve',
  description: 'Secure and configurable online voting platform.',
  assets: {
    logoTransparent: '/brand/seneve-logo-transparent.png',
    logoWhiteBackground: '/brand/seneve-logo-white-background.png',
    mark: '/brand/seneve-mark.png',
  },
  favicon16: '/brand/favicon-16x16.png',
  favicon32: '/brand/favicon-32x32.png',
  icon192: '/brand/icon-192x192.png',
  icon512: '/brand/icon-512x512.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',
  colors: {
    primary: '#b20000',
    foreground: '#363636',
    neutral: '#363636',
  },
} as const;

export const SENEVE_LOGO_VARIANTS = ['transparent', 'whiteBackground', 'mark'] as const;

export type SeneveLogoVariant = (typeof SENEVE_LOGO_VARIANTS)[number];

export function logoPathForVariant(variant: SeneveLogoVariant): string {
  if (variant === 'whiteBackground') {
    return SENEVE_BRAND.assets.logoWhiteBackground;
  }

  if (variant === 'mark') {
    return SENEVE_BRAND.assets.mark;
  }

  return SENEVE_BRAND.assets.logoTransparent;
}

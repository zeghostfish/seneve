import type { MetadataRoute } from 'next';

import { SENEVE_BRAND } from '../lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SENEVE_BRAND.name,
    short_name: SENEVE_BRAND.name,
    description: SENEVE_BRAND.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: SENEVE_BRAND.colors.primary,
    icons: [
      {
        src: SENEVE_BRAND.icon192,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: SENEVE_BRAND.icon512,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

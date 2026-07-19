import './globals.css';

import type { Metadata } from 'next';

import { SENEVE_BRAND } from '../lib/brand';
import { AppProviders } from '../providers/app-providers';

export const metadata: Metadata = {
  title: {
    default: SENEVE_BRAND.name,
    template: `%s | ${SENEVE_BRAND.name}`,
  },
  description: SENEVE_BRAND.description,
  applicationName: SENEVE_BRAND.name,
  icons: {
    icon: [
      { url: SENEVE_BRAND.favicon16, sizes: '16x16', type: 'image/png' },
      { url: SENEVE_BRAND.favicon32, sizes: '32x32', type: 'image/png' },
      { url: SENEVE_BRAND.assets.mark, type: 'image/png' },
    ],
    apple: [{ url: SENEVE_BRAND.appleTouchIcon, sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: SENEVE_BRAND.name,
    description: SENEVE_BRAND.description,
    siteName: SENEVE_BRAND.name,
    type: 'website',
  },
  appleWebApp: {
    title: SENEVE_BRAND.name,
    capable: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

import { describe, expect, it } from 'vitest';

import { SENEVE_BRAND } from '../lib/brand';
import { metadata } from './layout';
import manifest from './manifest';

describe('web metadata', () => {
  it('uses the official Seneve name and description', () => {
    expect(metadata.applicationName).toBe(SENEVE_BRAND.name);
    expect(metadata.description).toBe(SENEVE_BRAND.description);
    expect(metadata.icons).toEqual(
      expect.objectContaining({
        icon: expect.arrayContaining([
          expect.objectContaining({ url: SENEVE_BRAND.favicon16 }),
          expect.objectContaining({ url: SENEVE_BRAND.favicon32 }),
        ]),
        apple: expect.arrayContaining([
          expect.objectContaining({ url: SENEVE_BRAND.appleTouchIcon }),
        ]),
      }),
    );
  });

  it('publishes manifest icon paths from the brand constants', () => {
    const appManifest = manifest();

    expect(appManifest.name).toBe(SENEVE_BRAND.name);
    expect(appManifest.description).toBe(SENEVE_BRAND.description);
    expect(appManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: SENEVE_BRAND.icon192 }),
        expect.objectContaining({ src: SENEVE_BRAND.icon512 }),
      ]),
    );
  });
});

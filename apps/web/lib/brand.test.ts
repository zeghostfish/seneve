import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SENEVE_BRAND } from './brand';

const publicRoot = join(process.cwd(), 'apps/web/public');

describe('SENEVE_BRAND', () => {
  it('references existing public brand assets', () => {
    const assetPaths = [
      SENEVE_BRAND.assets.logoTransparent,
      SENEVE_BRAND.assets.logoWhiteBackground,
      SENEVE_BRAND.assets.mark,
      SENEVE_BRAND.favicon16,
      SENEVE_BRAND.favicon32,
      SENEVE_BRAND.icon192,
      SENEVE_BRAND.icon512,
      SENEVE_BRAND.appleTouchIcon,
    ];

    for (const assetPath of assetPaths) {
      expect(existsSync(join(publicRoot, assetPath))).toBe(true);
    }
  });
});

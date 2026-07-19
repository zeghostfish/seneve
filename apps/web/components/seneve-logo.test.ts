import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';
import { SENEVE_BRAND, SENEVE_LOGO_VARIANTS, logoPathForVariant } from '../lib/brand';
import { SeneveLogo } from './seneve-logo';

describe('SeneveLogo', () => {
  it('renders the transparent logo with accessible text by default', () => {
    const markup = renderToStaticMarkup(
      createElement(SeneveLogo, { variant: 'transparent', size: 'md' }),
    );

    expect(markup).toContain(`src="${SENEVE_BRAND.assets.logoTransparent}"`);
    expect(markup).toContain('alt="Seneve"');
    expect(markup).toContain('width="2412"');
    expect(markup).toContain('height="644"');
  });

  it('selects the white-background and mark variants from centralized brand paths', () => {
    expect(logoPathForVariant('whiteBackground')).toBe(SENEVE_BRAND.assets.logoWhiteBackground);
    expect(logoPathForVariant('mark')).toBe(SENEVE_BRAND.assets.mark);

    const whiteBackgroundMarkup = renderToStaticMarkup(
      createElement(SeneveLogo, { variant: 'whiteBackground', size: 'sm' }),
    );
    const markMarkup = renderToStaticMarkup(
      createElement(SeneveLogo, { variant: 'mark', size: 'lg', alt: '' }),
    );

    expect(whiteBackgroundMarkup).toContain(`src="${SENEVE_BRAND.assets.logoWhiteBackground}"`);
    expect(markMarkup).toContain(`src="${SENEVE_BRAND.assets.mark}"`);
    expect(markMarkup).toContain('alt=""');
  });

  it('does not expose a dark variant without an approved inverse logo', () => {
    expect(SENEVE_LOGO_VARIANTS).not.toContain('dark');
    expect(SENEVE_LOGO_VARIANTS).not.toContain('light');
  });

  it('renders the brand in the shell header', () => {
    const markup = renderToStaticMarkup(createElement(HomePage));

    expect(markup).toContain(`src="${SENEVE_BRAND.assets.logoTransparent}"`);
    expect(markup).toContain('Secure and configurable online voting platform.');
  });
});

# Seneve Brand Asset Guidelines

## Status

Official brand assets were integrated during Epic 002 after Phase 14.

The supplied source files are the visual source of truth. Do not redesign, reinterpret, recolor or
rebuild the logo.

## Source Asset Inspection

| Source file               | Format   | Original size | Alpha                   | Background             | Usage decision                           |
| ------------------------- | -------- | ------------- | ----------------------- | ---------------------- | ---------------------------------------- |
| `seneve io logo sans.png` | PNG RGBA | 3554 x 1857   | yes, transparent canvas | transparent            | canonical reusable wordmark source       |
| `seneve io logo 1.png`    | PNG RGB  | 3554 x 1857   | no                      | baked white background | alternate source with baked white canvas |

Both source files opened successfully and contain the same visible artwork bounds:

```text
content bbox: x=636 y=718 width=2284 height=516
```

The optimized web logo crops preserve the complete artwork and include safe padding.

## Asset Paths

Master files:

```text
apps/web/public/brand/master/seneve-logo-source-transparent.png
apps/web/public/brand/master/seneve-logo-source-white-background.png
```

Web assets:

```text
apps/web/public/brand/seneve-logo-transparent.png
apps/web/public/brand/seneve-logo-white-background.png
apps/web/public/brand/seneve-mark.png
apps/web/public/brand/favicon-16x16.png
apps/web/public/brand/favicon-32x32.png
apps/web/public/brand/icon-192x192.png
apps/web/public/brand/icon-512x512.png
apps/web/public/brand/apple-touch-icon.png
```

## Usage

Use `seneve-logo-transparent.png` on surfaces providing sufficient contrast.

Use `seneve-logo-white-background.png` only when a guaranteed white presentation block is required.
This asset contains a baked white canvas. It is not a dark-theme logo.

No official inverse white wordmark currently exists. Dark interfaces should use the transparent
wordmark only when contrast is sufficient, place the transparent wordmark inside an intentional light
brand container, or use the standalone mark.

Use `seneve-mark.png` for:

- favicons;
- PWA icons;
- compact mobile navigation;
- loading states;
- future application icons.

## Clear Space

Maintain clear space around the full logo at least equal to the width of one red bar in the mark.

Do not place text, borders, badges or controls inside that clear-space area.

## Minimum Sizes

Recommended minimum rendered sizes:

- full logo: 112 px wide;
- standalone mark: 24 px high;
- favicon: use the generated favicon assets only.

## Prohibited Modifications

Do not:

- stretch or distort the logo;
- recolor the red bars or wordmark;
- change bar width, vertical offset or spacing;
- modify the wordmark;
- add shadows, gradients, outlines or effects;
- describe the white-background asset as a dark-mode logo;
- place the transparent wordmark directly on an insufficiently contrasting dark background;
- rebuild the wordmark from an unrelated font;
- crop into the artwork;
- use CSS filters to manufacture logo variants.

## Product Name

Use the official product spelling:

```text
Seneve
```

Do not use accented or alternate spellings in code, filenames, metadata or UI without a future
branding decision.

# Seneve Design System

## Status

Initial design-token documentation was introduced with official brand asset integration.

## Brand Tokens

The following colors are extracted from the official Seneve logo pixels.

| Token              | Hex       | RGB          | Source            |
| ------------------ | --------- | ------------ | ----------------- |
| `brand-primary`    | `#b20000` | `178, 0, 0`  | red vertical bars |
| `brand-foreground` | `#363636` | `54, 54, 54` | wordmark          |
| `brand-neutral`    | `#363636` | `54, 54, 54` | wordmark neutral  |

CSS variables are available in the web shell:

```css
--brand-primary: #b20000;
--brand-foreground: #363636;
--brand-neutral: #363636;
```

## Semantic Color Rule

Brand red is not automatically the error, destructive or warning color.

Use `brand-primary` only for brand identity moments. Destructive and validation states must continue
to use semantic tokens chosen for accessibility and context.

## Logo Component

The web shell provides:

```tsx
<SeneveLogo variant="transparent" size="md" priority />
```

Supported variants:

- `transparent`: transparent wordmark for surfaces providing sufficient contrast;
- `whiteBackground`: official cropped logo with a baked white canvas;
- `mark`: standalone red mark.

Supported sizes:

- `sm`;
- `md`;
- `lg`;
- `custom`.

The default accessible alternative text is `Seneve`. Decorative repeated marks may use an empty
alternative text.

## Frontend Shell

The authenticated shell uses:

- the standalone mark in compact navigation and loading states;
- restrained neutral surfaces for repeated operational use;
- visible focus and hover states on controls;
- semantic colors for warnings, errors and destructive actions.

Authentication and organization screens must remain responsive across desktop, tablet and mobile.
Cards are used for bounded forms and repeated records only; page regions remain simple full-width
sections.

## Form Guidance

Client-side validation is used for fast feedback on:

- email shape;
- password confirmation;
- organization slug;
- locale;
- timezone;
- invitation role.

Backend validation remains authoritative. Client validation must not expose sensitive account-state
details or duplicate backend policy conditions that could drift.

## Campaign And Candidate Status

Campaign and Candidate statuses use centralized presentation helpers in
`apps/web/lib/campaigns/status.ts`.

Status presentation distinguishes:

- neutral draft and archived states;
- positive active or eligible states;
- warning paused or suspended states;
- destructive cancelled or disqualified states.

Color is never the only indicator; visible text labels remain present.

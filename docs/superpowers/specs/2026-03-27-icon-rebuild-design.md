# Icon Rebuild Design

**Goal:** Rebuild the app's web and Android icon assets from the provided Drone Blast logo and use one shared artwork source for future regeneration.

## Design

Use a single SVG artwork definition that matches the supplied logo's structure: dark charcoal background, blue/orange motion emblem, white drone, and stacked `DRONE BLAST` wordmark. Generate all web icons, Android launcher assets, and Android splash images from that shared source so the branding stays consistent.

## Outputs

- `public/favicon.svg`
- `public/icons/favicon-64.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- Android launcher PNGs in `android/app/src/main/res/mipmap-*`
- Android splash PNGs in `android/app/src/main/res/drawable*`
- Android launcher background color resources aligned to the new dark background

## Implementation Notes

- Keep the artwork generator in code so assets can be regenerated without manual editing.
- Accept the user's preference for the full logo on launcher icons and splash screens, even though that reduces small-size legibility.
- Add a focused test around the artwork generator so future changes do not silently drop the wordmark or break rendering.

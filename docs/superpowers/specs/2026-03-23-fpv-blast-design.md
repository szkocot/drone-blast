# Drone Blast — Design Specification

**Date:** 2026-03-23
**Platform:** PWA (Progressive Web App) — Svelte 4 + TypeScript + Vite
**Deploy:** GitHub Pages via GitHub Actions
**Language:** English (Polish localisation planned for later)

---

## Overview

Drone Blast is a single-screen PWA for FPV drone pilots. It fetches wind forecasts from the Open-Meteo free API, averages all available weather model sources (with outlier removal), and displays the results as a colour-coded heatmap of wind speed across altitude (10–180 m) and time (24-hour sliding window over 7 days). Installed on iPhone via Safari → Share → Add to Home Screen.

---

## Architecture

**Pattern:** Svelte component tree with a plain TypeScript service layer. No CSS framework — scoped Svelte component styles. Canvas for the heatmap.

```
src/
├── lib/
│   ├── services/
│   │   ├── openMeteo.ts        Fetch + decode Open-Meteo JSON per model
│   │   ├── windProcessor.ts    IQR outlier removal, linear interpolation, mean
│   │   └── geocoder.ts         Reverse geocoding via BigDataCloud (no API key)
│   ├── stores/
│   │   ├── windStore.ts        Svelte writable store: WindGrid, fetchState, hourOffset
│   │   └── settingsStore.ts    Svelte writable store: threshold, unit, appearance — persisted to localStorage
│   ├── components/
│   │   ├── AppHeader.svelte    App name, location name, current date
│   │   ├── SummaryStrip.svelte 3-card strip: Now @10m | Peak | Best Today
│   │   ├── HeatmapCanvas.svelte Canvas-rendered wind heatmap
│   │   ├── TimeSlider.svelte   7-day drag slider, hour-snapping
│   │   ├── ThresholdFooter.svelte Threshold value, colour legend, ⚙ button
│   │   ├── SettingsSheet.svelte Modal settings panel
│   │   └── ErrorBanner.svelte  Reusable warning/error banner
│   └── types.ts                Shared TypeScript types
├── App.svelte                  Root component; wires location → windStore; colorScheme
├── main.ts                     Svelte mount + service worker registration
├── sw.ts                       Service worker (Vite PWA plugin handles generation)
└── app.css                     Global CSS reset + CSS custom properties for theming
public/
├── manifest.json               PWA manifest
└── icons/                      App icons (192×192, 512×512)
```

**Data flow:**
1. App mounts → `navigator.geolocation.getCurrentPosition()`
2. GPS coords → `geocoder.ts` reverse-geocodes city name (BigDataCloud, free, no key)
3. GPS coords → `windStore.fetch(lat, lon)` called
4. `openMeteo.ts` fetches 6 models in parallel via `Promise.allSettled()`
5. `windProcessor.ts`: per `(hour, height)` cell → IQR outlier removal → mean → linear interpolation for intermediate heights
6. `windStore` publishes `WindGrid`; Svelte reactivity re-renders components
7. Refresh triggered on app visibility change (`visibilitychange` event) and on location change > 5 km

---

## Data Layer

### Open-Meteo API

- **Endpoint:** `GET https://api.open-meteo.com/v1/forecast`
- **No API key required** (free tier)
- **Parameters per model request:**
  - `latitude`, `longitude` — from GPS
  - `hourly=wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m`
  - `wind_speed_unit=kmh`
  - `forecast_days=7`
  - `models=<model_id>`
  - `timezone=auto`
- **Models:** `best_match`, `ecmwf_ifs04`, `gfs_seamless`, `icon_seamless`, `gem_seamless`, `meteofrance_seamless`
- All 6 fetched in parallel via `Promise.allSettled()`. Rejected promises are silently dropped.
- Minimum 2 successful responses required to show data.

### Reverse Geocoding

BigDataCloud free reverse geocoding (no API key):
`GET https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=X&longitude=Y&localityLanguage=en`

Returns `{ city, countryName }` — displayed as "Kraków, Poland".

### Height Interpolation

Open-Meteo provides 4 heights: 10 m, 80 m, 120 m, 180 m. App displays 18 levels (10–180 m, 10 m steps). Intermediate heights computed via linear interpolation:

- 10–80 m: interpolate between 10 m and 80 m
- 80–120 m: interpolate between 80 m and 120 m
- 120–180 m: interpolate between 120 m and 180 m

### Outlier Removal (IQR Method)

Per `(hour, height)` cell across all model values:
1. Sort values, compute Q1 (25th pct), Q3 (75th pct), IQR = Q3 − Q1
2. Discard values outside `[Q1 − 1.5×IQR, Q3 + 1.5×IQR]`
3. Mean of remaining values. If < 2 remain after removal, use all values.

### Colour Thresholds

Given user threshold `T` (internally stored in km/h):

| Colour | Condition |
|--------|-----------|
| Green  | wind < T × 0.8 |
| Yellow | T × 0.8 ≤ wind < T |
| Red    | wind ≥ T |

---

## TypeScript Types

```typescript
// src/lib/types.ts

export type WindUnit = 'kmh' | 'ms' | 'knots';
export type AppAppearance = 'auto' | 'light' | 'dark';

export interface WindGrid {
  data: number[][];   // [timeIndex][heightIndex], km/h; 168×18
  times: Date[];      // 168 entries
  modelCount: number;
}

export interface FlyingWindow {
  startHour: number;
  duration: number;
  mode: 'allHeights' | 'lowOnly';
}

export interface Settings {
  thresholdKmh: number;   // default 25
  unit: WindUnit;         // default 'kmh'
  appearance: AppAppearance; // default 'auto'
}

export type FetchState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'loaded'; modelCount: number }
  | { type: 'failed'; message: string };
```

---

## UI Structure

Single-screen app — no routing.

```
App.svelte
├── AppHeader              App name · location name · date
├── SummaryStrip           Now @10m | Peak | Best Today
├── ErrorBanner            (conditional) warning/error
├── HeatmapCanvas          Canvas heatmap: X=hours, Y=10–180m
├── TimeSlider             24h window slider across 7 days (hour-snapping)
└── ThresholdFooter        Threshold · legend · ⚙ → SettingsSheet (modal)
```

### Summary Strip Cards

| Card | Content |
|------|---------|
| **Now · 10m** | Current hour wind @ 10m; colour-coded |
| **Peak** | Max wind across all heights in current 24h window; shows altitude |
| **Best Today** | Start + duration of longest green window (see logic below) |

### Best Flying Time Logic

1. Longest contiguous run of hours (within today's 24h) where **all 18 heights** are green (< T × 0.8).
2. Fallback: longest run where **lowest 6 heights (10–60 m)** are all green. Card label shows "BEST · LOW".
3. No window found → show "No window" in red.

### Settings Sheet

Slide-up modal panel (not browser `<dialog>` — custom Svelte overlay):

| Setting | Control | Range |
|---------|---------|-------|
| Wind Threshold | Stepper buttons (−/+) | 5–150 km/h, step 1; displayed in current unit |
| Wind Speed Unit | Segmented button group | km/h / m/s / kn |
| Appearance | Segmented button group | Auto / Light / Dark |
| Data Sources | Read-only row | "N / 6 sources active" |

Settings persisted to `localStorage` on every change.

### Appearance

- `auto`: follows `prefers-color-scheme` media query
- `light` / `dark`: sets `data-theme="light"` or `data-theme="dark"` on `<html>`
- CSS custom properties (`--bg`, `--surface`, `--text`, etc.) defined for both themes in `app.css`

---

## HeatmapCanvas Rendering

Canvas element sized to fill available width. Drawn on every `hourOffset` or `settings` change.

- **Grid:** 24 columns × 18 rows of filled rectangles
- **Cell colour:** `windColor(speed, threshold)` → green / yellow / red with opacity scaled by intensity
- **X labels:** HH:MM every 3 hours, drawn below canvas
- **Y labels:** height in metres every 20 m, drawn left of canvas

Cell colour function:
```typescript
function windColor(speed: number, threshold: number): string {
  const ratio = speed / threshold;
  const opacity = 0.35 + Math.min(ratio / 1.5, 1) * 0.55;
  if (ratio < 0.8)  return `rgba(74,255,128,${opacity})`;
  if (ratio < 1.0)  return `rgba(255,208,50,${opacity})`;
  return             `rgba(255,60,60,${opacity})`;
}
```

---

## PWA Configuration

- `public/manifest.json`: `name: "Drone Blast"`, `display: standalone`, `background_color`, `theme_color`, icons 192 + 512px
- iOS meta tags in `index.html`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`
- Service worker generated by `vite-plugin-pwa` (Workbox): pre-caches app shell; API calls are network-only (no stale forecast data)

---

## Loading & Error States

| State | UI |
|-------|-----|
| Initial load | Full-screen spinner "Fetching forecast…" |
| GPS denied | Full-screen card "Location access required" + link to browser settings help |
| GPS unavailable | ErrorBanner with retry button |
| All models failed | Full-screen error "Could not load forecast" + retry |
| 2–5 models succeeded | Yellow ErrorBanner "Limited data — N of 6 sources"; chart still shown |

No stale data shown after page reload.

---

## Refresh Policy

- On `visibilitychange` → `document.visibilityState === 'visible'`
- On location change > 5 km from last fetch coordinates
- No background sync

---

## Deployment

- **Repo:** public GitHub repo (required for free GitHub Pages)
- **Trigger:** push to `main`
- **GitHub Actions workflow:** `npm ci` → `npm run build` → deploy `dist/` to `gh-pages` branch using `peaceiris/actions-gh-pages`
- **URL:** `https://<username>.github.io/fpv-blast/`
- **Vite base path:** set `base: '/fpv-blast/'` in `vite.config.ts`

---

## Localisation

- English only in v1
- All user-facing strings extracted to a `i18n/en.ts` constants file from the start to facilitate future Polish localisation

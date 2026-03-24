# Drone Blast

A wind forecast PWA for FPV drone pilots. Shows a 7-day wind speed heatmap across 18 altitude layers (10–180 m) so you can instantly see when and where it's safe to fly.

## Features

- **Wind heatmap** — colour-coded grid of wind speed vs. altitude vs. time, with smooth bilinear gradients
- **7-day slider** — drag to navigate the forecast; the track itself is coloured by wind speed
- **Configurable threshold** — set your personal fly/no-fly speed limit; all colours update in real time
- **Best window** — automatically finds the calmest upcoming 4-hour window
- **Multi-model averaging** — blends 6 open-meteo forecast models and filters outliers
- **Re-fetch radius** — don't waste API calls when you haven't moved (configurable, default 5 km)
- **Full-width desktop layout** — works great on laptop/desktop browsers, not just mobile
- **PWA** — installable on iOS, Android, and desktop; works offline after first load
- **Dark / light / auto theme**

## Live App

👉 **https://droneblast.ovh/**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Svelte 5](https://svelte.dev/) + TypeScript |
| Build | [Vite](https://vitejs.dev/) + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) |
| Wind data | [Open-Meteo](https://open-meteo.com/) free API (no key required) |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) |
| Rendering | Canvas 2D (heatmap + slider gradient) |
| Tests | [Vitest](https://vitest.dev/) — 42 unit tests |
| Deploy | GitHub Actions → GitHub Pages |

## Getting Started

```bash
git clone https://github.com/szymonkocot/fpv-blast.git
cd fpv-blast
npm install
npm run dev
```

The dev server starts at `https://localhost:5173` (HTTPS for geolocation, provided by `@vitejs/plugin-basic-ssl`).

## Running Tests

```bash
npm test          # watch mode
npm test -- --run # single run
```

## Building

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build
```

## How It Works

1. **Location** — browser Geolocation API; re-fetches only when you move more than the configured radius
2. **Forecast** — queries Open-Meteo for 6 ensemble models at 4 altitude levels; interpolates linearly to 18 display heights (10–180 m in 10 m steps)
3. **Outlier filtering** — removes any model whose mean speed is > 2× the median before averaging
4. **Colour scale** — green (< 80% of threshold) → yellow (80–100%) → red (> threshold); opacity scales with speed
5. **Best window** — slides a 4-hour window across today, picks the one with lowest max speed at any height

## Project Structure

```
src/
  lib/
    components/      # Svelte UI components
    services/        # openMeteo API + geocoder
    stores/          # settingsStore, windStore
    i18n/            # English strings
    types.ts         # shared TypeScript types
    windGrid.ts      # grid slicing helpers
    windProcessor.ts # model merging + outlier filter
  App.svelte
  main.ts
public/
  icons/             # PWA icons
  manifest.json
.github/workflows/deploy.yml
```

## License

MIT

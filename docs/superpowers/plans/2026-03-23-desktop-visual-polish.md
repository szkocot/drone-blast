# Desktop Layout & Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the 480 px width cap, add rounded bilinear-gradient heatmap cells, add a canvas-drawn coloured slider track, and add a configurable re-fetch radius setting.

**Architecture:** Four independent surgical changes across `app.css`, `HeatmapCanvas.svelte`, `TimeSlider.svelte`+`App.svelte`, and the settings layer. No routing, store, or service changes (except adding a field to `Settings`). Canvas rendering is visual-only; no new unit tests required for canvas tasks — existing 39 tests must continue to pass. Task 4 (radius) adds one pure-function test.

**Tech Stack:** Svelte 5 (legacy export-let props), Canvas 2D API, TypeScript, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/app.css` | Remove `max-width: 480px`; add `@media (min-width: 768px)` block |
| `src/lib/components/HeatmapCanvas.svelte` | Rounded cells + bilinear gradient + responsive label sizes |
| `src/lib/components/TimeSlider.svelte` | Remove `.fill`/`::before`; add canvas track + window-highlight; add `thresholdKmh` prop |
| `src/App.svelte` | Pass `thresholdKmh` to `<TimeSlider>` |
| `src/lib/types.ts` | Add `refetchRadiusKm: number` to `Settings` |
| `src/lib/stores/settingsStore.ts` | Add `refetchRadiusKm: 5` to `defaults()`; export `haversineKm` |
| `src/lib/i18n/en.ts` | Add `refetchRadius` and `refetchRadiusHint` strings |
| `src/lib/components/SettingsSheet.svelte` | Add stepper row for re-fetch radius |
| `src/App.svelte` | Guard `fetchWind` call with radius check |
| `src/lib/stores/settingsStore.test.ts` | Unit test for `haversineKm` |

---

### Task 1: CSS — Remove width cap, add desktop scaling

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: Remove `max-width: 480px` from `#app`**

In `src/app.css`, the `#app` block currently reads:
```css
#app {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 480px;
  margin: 0 auto;
}
```

Remove `max-width: 480px` and `margin: 0 auto;` so the app fills the viewport on any width:
```css
#app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 2: Add `@media (min-width: 768px)` block for desktop scaling**

Append to the end of `src/app.css`:
```css
@media (min-width: 768px) {
  /* Slider hint and tick text */
  .hint { font-size: 12px !important; }
  .tick { font-size: 12px !important; }
  /* Settings gear icon */
  .gear { font-size: 26px !important; }
}
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

```bash
cd /Users/szymonkocot/Projects/fpv-blast && npm test -- --run
```

Expected: all 39 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app.css
git commit -m "feat: remove 480px width cap; add desktop font scaling"
```

---

### Task 2: HeatmapCanvas — Rounded cells with bilinear gradient

**Files:**
- Modify: `src/lib/components/HeatmapCanvas.svelte`

No new test file — canvas rendering is visual.

- [ ] **Step 1: Add `lerpRGBA` helper and parse `windColor` output**

At the top of `<script lang="ts">` (after imports), add:

```typescript
function parseRGBA(css: string): [number, number, number, number] {
  const m = css.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)/);
  if (!m) return [0, 0, 0, 1];
  return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
}

function lerpRGBA(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function toCSS([r, g, b, a]: [number, number, number, number]): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(2)})`;
}
```

- [ ] **Step 2: Update constants — remove module-level `LABEL_W`/`LABEL_H`, add `GAP` and `RADIUS`**

Remove the two `const` declarations at module level:
```typescript
const LABEL_W = 36;  // DELETE
const LABEL_H = 24;  // DELETE
```

Add instead:
```typescript
const GAP    = 2;   // px between cells
const RADIUS = 4;   // px corner radius
```

- [ ] **Step 3: Rewrite the `draw()` function**

Replace the entire `draw()` function with:

```typescript
function draw() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;

  // Responsive label sizes based on CSS layout width (avoids DPR issues)
  const isDesktop = canvas.offsetWidth > 600;
  const fontSize  = isDesktop ? 13 : 10;
  const LABEL_W   = isDesktop ? 50 : 36;
  const LABEL_H   = isDesktop ? 28 : 24;

  const chartW = W - LABEL_W;
  const chartH = H - LABEL_H;

  ctx.clearRect(0, 0, W, H);

  const slice = sliceGrid(grid, hourOffset);
  const cols = slice.length;            // up to 24
  const rows = DISPLAY_HEIGHTS.length;  // 18

  const cellW = (chartW - GAP * (cols - 1)) / cols;
  const cellH = (chartH - GAP * (rows - 1)) / rows;
  const strideX = cellW + GAP;
  const strideY = cellH + GAP;

  // Precompute RGBA for all cells (including one-beyond-edge clamps)
  const colors: [number, number, number, number][][] = [];
  for (let t = 0; t <= cols; t++) {
    colors[t] = [];
    for (let hi = 0; hi <= rows; hi++) {
      const speed = slice[Math.min(t, cols - 1)]?.[Math.min(hi, rows - 1)] ?? 0;
      colors[t][hi] = parseRGBA(windColor(speed, thresholdKmh));
    }
  }

  // Draw cells — bottom row = 10 m (hi=0), top row = 180 m (hi=rows-1)
  for (let hi = 0; hi < rows; hi++) {
    const cy = chartH - (hi + 1) * cellH - hi * GAP;  // vertical origin; flip: low height at bottom
    for (let t = 0; t < cols; t++) {
      const cx = LABEL_W + t * strideX;
      const nextT  = Math.min(t + 1, cols - 1);
      const nextHi = Math.min(hi + 1, rows - 1);

      const cBL = colors[t][hi];
      const cBR = colors[nextT][hi];
      const cTL = colors[t][nextHi];
      const cTR = colors[nextT][nextHi];

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx, cy, cellW, cellH, RADIUS);
      ctx.clip();

      // Pass 1 — vertical gradient (height axis), top = nextHi average, bottom = hi average
      const gV = ctx.createLinearGradient(0, cy, 0, cy + cellH);
      gV.addColorStop(0, toCSS(lerpRGBA(cTL, cTR, 0.5)));
      gV.addColorStop(1, toCSS(lerpRGBA(cBL, cBR, 0.5)));
      ctx.fillStyle = gV;
      ctx.fillRect(cx, cy, cellW, cellH);

      // Pass 2 — horizontal overlay (time axis) at 35% opacity
      const leftAvg  = lerpRGBA(cBL, cTL, 0.5);
      const rightAvg = lerpRGBA(cBR, cTR, 0.5);
      const gH = ctx.createLinearGradient(cx, 0, cx + cellW, 0);
      gH.addColorStop(0, toCSS([leftAvg[0],  leftAvg[1],  leftAvg[2],  0.35]));
      gH.addColorStop(1, toCSS([rightAvg[0], rightAvg[1], rightAvg[2], 0.35]));
      ctx.fillStyle = gH;
      ctx.fillRect(cx, cy, cellW, cellH);

      ctx.restore();
    }
  }

  // Y axis labels (every 20 m = every 2nd height index)
  ctx.fillStyle = '#888';
  ctx.font = `${fontSize}px -apple-system, sans-serif`;
  ctx.textAlign = 'right';
  for (let hi = 0; hi < rows; hi++) {
    if ((hi + 1) % 2 === 0) {
      const cy = chartH - (hi + 0.5) * cellH - hi * GAP;
      ctx.fillText(`${DISPLAY_HEIGHTS[hi]}m`, LABEL_W - 4, cy + fontSize / 2);
    }
  }

  // X axis labels (every 3 hours)
  ctx.textAlign = 'center';
  for (let t = 0; t < cols; t++) {
    if (t % 3 === 0 && t < grid.times.length) {
      const date = grid.times[hourOffset + t];
      if (!date) continue;
      const label = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const cx = LABEL_W + (t + 0.5) * strideX;
      ctx.fillText(label, cx, H - 4);
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/szymonkocot/Projects/fpv-blast && npm test -- --run
```

Expected: 39 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/HeatmapCanvas.svelte
git commit -m "feat: heatmap rounded cells with bilinear gradient and responsive labels"
```

---

### Task 3: TimeSlider — Canvas gradient track + window-highlight

**Files:**
- Modify: `src/lib/components/TimeSlider.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Add `thresholdKmh` prop and canvas state to TimeSlider script**

In `<script lang="ts">`, after the existing `export let onChange`:

```typescript
export let thresholdKmh: number;  // NEW

import { onMount } from 'svelte';
import { windColor } from '../stores/settingsStore';

let trackCanvas: HTMLCanvasElement;
```

Also add the `lerpRGBA` / `parseRGBA` / `toCSS` helpers (same as HeatmapCanvas):

```typescript
function parseRGBA(css: string): [number,number,number,number] {
  const m = css.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)/);
  if (!m) return [0,0,0,1];
  return [+m[1],+m[2],+m[3], m[4]!==undefined ? +m[4] : 1];
}
function toCSS([r,g,b,a]: [number,number,number,number]): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(2)})`;
}

function avgWindColor(t: number): string {
  let r=0,g=0,b=0,a=0;
  const rows = 18;
  for (let hi=0; hi<rows; hi++) {
    const speed = grid.data[t]?.[hi] ?? 0;
    const [cr,cg,cb,ca] = parseRGBA(windColor(speed, thresholdKmh));
    r+=cr; g+=cg; b+=cb; a+=ca;
  }
  return toCSS([r/rows, g/rows, b/rows, Math.min(1, a/rows * 1.2)]);
}

function drawTrack() {
  if (!trackCanvas) return;
  const parent = trackCanvas.parentElement!;
  const W = parent.clientWidth;
  const H = parent.clientHeight - 10;
  trackCanvas.width  = W;
  trackCanvas.height = H;
  const ctx = trackCanvas.getContext('2d')!;
  const total = Math.min(grid.times.length, 168);
  if (total < 2) return;
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  for (let t=0; t<total; t++) {
    grad.addColorStop(t / (total - 1), avgWindColor(t));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

$: thresholdKmh, drawTrack();   // reactive redraw when threshold changes

onMount(() => { drawTrack(); });
```

- [ ] **Step 2: Update the template — remove `.fill`, add canvas and window-highlight**

Replace the track `<div>` block. Currently:
```svelte
<div class="track" bind:this={trackEl} ...>
  <div class="fill" style="width: {fillPct}%"></div>
  <div class="thumb" style="left: {fillPct}%"></div>
</div>
```

Change to:
```svelte
<div
  class="track"
  bind:this={trackEl}
  on:pointerdown={onTrackDown}
  on:pointermove={e => e.buttons && handlePointer(e)}
  role="slider"
  aria-valuenow={hourOffset}
  aria-valuemin={0}
  aria-valuemax={MAX_OFFSET}
  tabindex="0"
>
  <canvas bind:this={trackCanvas} class="track-canvas"></canvas>
  <div
    class="window-highlight"
    style="left: {(hourOffset / 168 * 100).toFixed(2)}%; width: {(24 / 168 * 100).toFixed(2)}%"
  ></div>
  <div class="thumb" style="left: {fillPct}%"></div>
</div>
```

Also remove `$: fillPct = (hourOffset / MAX_OFFSET) * 100;` — the thumb still needs `fillPct` so keep it, but note `fillPct` is `(hourOffset / MAX_OFFSET) * 100` which keeps thumb positioned correctly.

- [ ] **Step 3: Update CSS — remove `.fill` and `::before`, add canvas and window-highlight styles**

In `<style>`, remove:
```css
.track::before {
  content: ''; position: absolute; inset: 6px 0;
  background: var(--border); border-radius: 2px;
}
.fill {
  position: absolute; left: 0; top: 6px; bottom: 6px;
  background: var(--blue); border-radius: 2px;
  pointer-events: none;
}
```

Add:
```css
.track-canvas {
  position: absolute; inset: 5px 0;
  border-radius: 4px; pointer-events: none;
}
.window-highlight {
  position: absolute; top: 3px; bottom: 3px;
  border: 2px solid rgba(255,255,255,0.75);
  border-radius: 4px; pointer-events: none;
}
```

- [ ] **Step 4: Pass `thresholdKmh` from App.svelte to TimeSlider**

In `src/App.svelte`, update the `<TimeSlider>` usage from:
```svelte
<TimeSlider
  grid={$windGrid}
  hourOffset={$hourOffset}
  onChange={v => hourOffset.set(v)}
/>
```

To:
```svelte
<TimeSlider
  grid={$windGrid}
  hourOffset={$hourOffset}
  thresholdKmh={$settingsStore.thresholdKmh}
  onChange={v => hourOffset.set(v)}
/>
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/szymonkocot/Projects/fpv-blast && npm test -- --run
```

Expected: 39 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/TimeSlider.svelte src/App.svelte
git commit -m "feat: coloured canvas gradient slider track with 24h window-highlight"
```

---

### Task 4: Settings — Re-fetch radius

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/stores/settingsStore.ts`
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/components/SettingsSheet.svelte`
- Modify: `src/App.svelte`
- Test: `src/lib/stores/settingsStore.test.ts`

The radius setting: if the user moves less than `refetchRadiusKm` km from the last fetch location, don't re-fetch. Default: 5 km.

- [ ] **Step 1: Write a failing test for `haversineKm`**

In `src/lib/stores/settingsStore.test.ts`, add:

```typescript
import { haversineKm } from './settingsStore';

describe('haversineKm', () => {
  it('returns ~0 for same point', () => {
    expect(haversineKm(50, 20, 50, 20)).toBeCloseTo(0, 5);
  });

  it('returns ~111 km for 1 degree latitude difference', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 0);
  });

  it('returns ~252 km between Kraków and Warsaw', () => {
    expect(haversineKm(50.06, 19.94, 52.23, 21.01)).toBeCloseTo(252, -1);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd /Users/szymonkocot/Projects/fpv-blast && npm test -- --run
```

Expected: new tests fail with "haversineKm is not a function".

- [ ] **Step 3: Add `refetchRadiusKm` to `Settings` type**

In `src/lib/types.ts`, update `Settings`:
```typescript
export interface Settings {
  thresholdKmh: number;
  unit: WindUnit;
  appearance: AppAppearance;
  refetchRadiusKm: number;  // NEW
}
```

- [ ] **Step 4: Add `haversineKm` and update `defaults()` in settingsStore**

In `src/lib/stores/settingsStore.ts`, update `defaults()`:
```typescript
function defaults(): Settings {
  return { thresholdKmh: 25, unit: 'kmh', appearance: 'auto', refetchRadiusKm: 5 };
}
```

Add `haversineKm` export at the bottom:
```typescript
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 5: Run tests to confirm passing**

```bash
cd /Users/szymonkocot/Projects/fpv-blast && npm test -- --run
```

Expected: all tests pass (39 + 3 new = 42).

- [ ] **Step 6: Add i18n strings**

In `src/lib/i18n/en.ts`, add two entries to the `t` object:
```typescript
refetchRadius: 'Re-fetch Radius',
refetchRadiusHint: 'Move this far before refreshing weather',
```

- [ ] **Step 7: Add radius stepper to SettingsSheet**

In `src/lib/components/SettingsSheet.svelte`, add a new section before the `<button class="done-btn">`:

```svelte
<div class="section">
  <div class="row">
    <div>
      <div class="row-title">{t.refetchRadius}</div>
      <div class="row-hint">{t.refetchRadiusHint}</div>
    </div>
    <div class="stepper">
      <button on:click={() => onChange({ refetchRadiusKm: Math.max(1, settings.refetchRadiusKm - 1) })}>−</button>
      <span>{settings.refetchRadiusKm} km</span>
      <button on:click={() => onChange({ refetchRadiusKm: Math.min(50, settings.refetchRadiusKm + 1) })}>+</button>
    </div>
  </div>
</div>
```

- [ ] **Step 8: Guard `fetchWind` call in App.svelte with radius check**

In `src/App.svelte`, add tracking variables and update `onLocation`:

```typescript
import { haversineKm } from './lib/stores/settingsStore';

let lastFetchLat: number | null = null;
let lastFetchLon: number | null = null;

function onLocation(pos: GeolocationPosition) {
  const { latitude: lat, longitude: lon } = pos.coords;
  const radius = $settingsStore.refetchRadiusKm;
  if (
    lastFetchLat !== null &&
    lastFetchLon !== null &&
    haversineKm(lastFetchLat, lastFetchLon, lat, lon) < radius
  ) {
    return; // within radius — skip re-fetch
  }
  lastFetchLat = lat;
  lastFetchLon = lon;
  fetchWind(lat, lon);
  reverseGeocode(lat, lon).then(name => locationName.set(name));
}
```

- [ ] **Step 9: Run all tests**

```bash
cd /Users/szymonkocot/Projects/fpv-blast && npm test -- --run
```

Expected: 42 tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/types.ts src/lib/stores/settingsStore.ts src/lib/i18n/en.ts src/lib/components/SettingsSheet.svelte src/App.svelte
git commit -m "feat: configurable re-fetch radius setting with haversine distance check"
```

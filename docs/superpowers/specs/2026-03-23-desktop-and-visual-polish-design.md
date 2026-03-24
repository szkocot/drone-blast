# Desktop Layout & Visual Polish — Design Specification

**Date:** 2026-03-23
**Scope:** Responsive desktop layout, heatmap visual improvements, coloured slider track

---

## Overview

Three coordinated changes to Drone Blast:

1. **Desktop layout** — remove the 480 px width cap so the app fills the browser on desktop/laptop screens.
2. **Heatmap rendering** — replace solid rectangles with rounded, gapless cells rendered with a 2-D bilinear gradient (smooth blending across both height and time axes).
3. **Time-slider colour track** — replace the plain grey track with a canvas-rendered gradient strip whose colour at each position reflects the average wind speed across all 18 heights for that hour.

The app remains a single-screen layout on all screen sizes; no routing or structural changes.

---

## 1. Desktop Layout (`app.css`, `App.svelte`)

### Change

Remove `max-width: 480px` from the `#app` selector in `app.css`. (`#app` is the Vite host element, not `.app-shell` inside `App.svelte` — they are different elements.) The app shell already uses `display: flex; flex-direction: column; height: 100%` — without the cap it will fill the viewport on any width.

### Responsive font and spacing scaling

Add a `@media (min-width: 768px)` block in `app.css` that scales up the settings gear icon and slider text. No layout restructuring — same vertical stack on all screen widths.

| Element | Mobile | Desktop (≥ 768 px) |
|---|---|---|
| Slider hint / tick text | 9–10 px | 12–13 px |
| Settings ⚙ icon (`ThresholdFooter`) | 18 px | 26 px |

Canvas-drawn labels (heatmap axis text) are handled separately inside `HeatmapCanvas.svelte` using `canvas.offsetWidth` (the CSS layout width, not the pixel-buffer width, which avoids device-pixel-ratio issues). See Section 2.

---

## 2. Heatmap Visual Polish (`HeatmapCanvas.svelte`)

### Cell rendering

Replace the current `ctx.fillRect(x, y, cellW - 0.5, cellH - 0.5)` approach with rounded cells that have a 2 px gap between them.

**Constants:**
```typescript
const GAP    = 2;   // px between cells
const RADIUS = 4;   // px corner radius
```

**Cell dimensions** (computed inside `draw()` after canvas is sized):
```typescript
const cellW = (chartW - GAP * (cols - 1)) / cols;
const cellH = (chartH - GAP * (rows - 1)) / rows;
```

**Cell placement stride** (origin of the next cell, not the draw size):
```typescript
const strideX = cellW + GAP;
const strideY = cellH + GAP;
```

For column `t` and height row `hi` (where `hi = 0` is 10 m at the bottom):
```typescript
const x = t * strideX;
const y = chartH - (hi + 1) * cellH - hi * GAP;  // flip: low height at bottom
```

### 2-D bilinear gradient per cell

Each cell blends colour from four corners (current/next hour × current/next height). Draw order per cell:

```typescript
ctx.save();
ctx.beginPath();
ctx.roundRect(x, y, cellW, cellH, RADIUS);
ctx.clip();                          // clip both passes to rounded shape

// Pass 1 — vertical gradient (height axis)
const gV = ctx.createLinearGradient(0, y, 0, y + cellH);
gV.addColorStop(0, colorTopAvg);    // average of top-left and top-right corners
gV.addColorStop(1, colorBotAvg);    // average of bottom-left and bottom-right corners
ctx.fillStyle = gV;
ctx.fillRect(x, y, cellW, cellH);

// Pass 2 — horizontal overlay (time axis), partial opacity
const gH = ctx.createLinearGradient(x, 0, x + cellW, 0);
gH.addColorStop(0, colorLeftAvg_at35pctOpacity);
gH.addColorStop(1, colorRightAvg_at35pctOpacity);
ctx.fillStyle = gH;
ctx.fillRect(x, y, cellW, cellH);

ctx.restore();
```

`colorTopAvg` = `lerpRGBA(colors[t][nextHi], colors[nextT][nextHi], 0.5)`, and so on for the other three averaged edges. `lerpRGBA` does component-wise linear interpolation.

No explicit grid lines are drawn. The `GAP` provides visual separation.

### Responsive canvas label font size

Inside `draw()`, choose font size based on `canvas.offsetWidth` (CSS layout width, device-pixel-ratio agnostic):

```typescript
const isDesktop = canvas.offsetWidth > 600;
const fontSize  = isDesktop ? 13 : 10;
const LABEL_W   = isDesktop ? 50 : 36;
const LABEL_H   = isDesktop ? 28 : 24;
```

Pass `fontSize` to `ctx.font` for both axis label passes.

---

## 3. Coloured Slider Track (`TimeSlider.svelte`)

### Structural changes

- **Remove** the `.fill` div and its CSS entirely (the blue filled portion of the current track).
- **Remove** the `::before` grey track pseudo-element CSS.
- **Add** a `<canvas bind:this={trackCanvas}></canvas>` absolutely positioned to fill the track area (`inset: 5px 0; border-radius: 4px`).
- **Add** a `<div class="window-highlight">` (white border box, no fill) to show the current 24 h window.
- The `.thumb` div is unchanged.

### New prop

```typescript
export let thresholdKmh: number;   // NEW — triggers track redraw
```

`App.svelte` passes `thresholdKmh={$settingsStore.thresholdKmh}` to `<TimeSlider>`.

### Canvas draw logic

Draw once on `onMount` and again reactively whenever `thresholdKmh` changes:

```typescript
let trackCanvas: HTMLCanvasElement;

function drawTrack() {
  if (!trackCanvas) return;
  const W = trackCanvas.parentElement!.clientWidth;
  const H = trackCanvas.parentElement!.clientHeight - 10;
  trackCanvas.width = W;
  trackCanvas.height = H;
  const ctx = trackCanvas.getContext('2d')!;

  const total = Math.min(grid.times.length, 168);  // guard for short forecasts
  if (total < 2) return;

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  for (let t = 0; t < total; t++) {
    grad.addColorStop(t / (total - 1), avgWindColor(t));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

$: thresholdKmh, drawTrack();   // reactive redraw when threshold changes

onMount(() => { drawTrack(); });
```

`avgWindColor(t)` computes the arithmetic mean of R, G, B, A across all 18 heights and returns a CSS `rgba(...)` string using `windColor(speed, thresholdKmh)` for each height. If `grid.times.length < 168`, only that many stops are drawn — the gradient simply ends at the last available hour rather than leaving a gap.

### Window-highlight positioning

```svelte
<div
  class="window-highlight"
  style="left: {(hourOffset / 168 * 100).toFixed(2)}%; width: {(24 / 168 * 100).toFixed(2)}%"
></div>
```

CSS:
```css
.window-highlight {
  position: absolute; top: 3px; bottom: 3px;
  border: 2px solid rgba(255,255,255,0.75);
  border-radius: 4px; pointer-events: none;
}
```

---

## Files Changed

| File | Change |
|---|---|
| `src/app.css` | Remove `max-width: 480px`; add `@media (min-width: 768px)` for gear icon and slider text sizes |
| `src/lib/components/HeatmapCanvas.svelte` | Rounded cells with gap, bilinear gradient, responsive font/label sizes via `canvas.offsetWidth` |
| `src/lib/components/TimeSlider.svelte` | Remove `.fill` div and `::before` track; add canvas gradient track; add `thresholdKmh` prop; add window-highlight div |
| `src/App.svelte` | Pass `thresholdKmh={$settingsStore.thresholdKmh}` to `<TimeSlider>` |

No new files. No changes to stores, services, or tests.

---

## Testing

No new unit tests required (canvas rendering is visual). Existing 39 tests must continue to pass. Manual verification:

- Desktop (≥ 768 px): app fills full width, axis labels readable at 13 px, ⚙ icon clearly tappable at 26 px.
- Mobile (< 768 px): layout and label sizes unchanged from current.
- Heatmap: rounded cells visible with 2 px gaps, no grid lines, colour blends smoothly across both axes.
- Slider track: shows wind colour gradient across 7 days; window-highlight box moves as thumb is dragged.
- Threshold change: slider track redraws with updated colour boundaries.
- Short forecast (< 168 hours): slider track draws to the last available hour without errors.

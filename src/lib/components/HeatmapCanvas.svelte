<!-- src/lib/components/HeatmapCanvas.svelte -->
<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { DISPLAY_HEIGHTS } from '../types';
  import { windColor } from '../stores/settingsStore';
  import { sliceGrid } from '../windGrid';
  import type { WindGrid } from '../types';
  import { t } from '../i18n';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let thresholdKmh: number;

  $: dateLocale = $t.dateLocale;

  let canvas: HTMLCanvasElement;

  const GAP    = 2;   // px between cells
  const RADIUS = 4;   // px corner radius

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

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    // Responsive label sizes based on CSS layout width (avoids DPR issues)
    const isDesktop = canvas.offsetWidth > 600;
    const fontSize  = isDesktop ? 13 : 12;
    const LABEL_W   = isDesktop ? 50 : 38;
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

    // Precompute RGBA for all cells (including one-beyond-edge clamps for gradient blending)
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
      const cy = chartH - (hi + 1) * cellH - hi * GAP;  // flip: low height at bottom
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

        // Pass 1 — vertical gradient (height axis)
        const gV = ctx.createLinearGradient(0, cy, 0, cy + cellH);
        gV.addColorStop(0, toCSS(lerpRGBA(cTL, cTR, 0.5)));  // top = nextHi average
        gV.addColorStop(1, toCSS(lerpRGBA(cBL, cBR, 0.5)));  // bottom = hi average
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
    ctx.fillStyle = '#aaa';
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
        const label = date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
        const cx = LABEL_W + (t + 0.5) * strideX;
        ctx.fillText(label, cx, H - 4);
      }
    }
  }

  function resize() {
    if (!canvas) return;
    const parent = canvas.parentElement!;
    canvas.width  = parent.clientWidth;
    canvas.height = parent.clientHeight - 8;  // 8px = top padding of .canvas-wrap
    draw();
  }

  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  });

  afterUpdate(draw);
</script>

<div class="canvas-wrap">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .canvas-wrap {
    width: 100%;
    height: 100%;
    padding: 8px 0 0;
  }
  canvas {
    display: block;
    width: 100%;
  }
</style>

<!-- src/lib/components/HeatmapCanvas.svelte -->
<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { DISPLAY_HEIGHTS } from '../types';
  import { windColor } from '../stores/settingsStore';
  import { sliceGrid } from '../windGrid';
  import type { WindGrid } from '../types';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let thresholdKmh: number;

  let canvas: HTMLCanvasElement;
  const LABEL_W = 36;  // px reserved for Y-axis labels
  const LABEL_H = 24;  // px reserved for X-axis labels

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const chartW = W - LABEL_W;
    const chartH = H - LABEL_H;

    ctx.clearRect(0, 0, W, H);

    const slice = sliceGrid(grid, hourOffset);
    const cols = slice.length;       // up to 24
    const rows = DISPLAY_HEIGHTS.length; // 18

    const cellW = chartW / cols;
    const cellH = chartH / rows;

    // Draw cells (bottom = 10m, top = 180m)
    for (let hi = 0; hi < rows; hi++) {
      const y = chartH - (hi + 1) * cellH; // flip: low height at bottom
      for (let t = 0; t < cols; t++) {
        const speed = slice[t][hi];
        ctx.fillStyle = windColor(speed, thresholdKmh);
        ctx.fillRect(LABEL_W + t * cellW, y, cellW - 0.5, cellH - 0.5);
      }
    }

    // Y axis labels (every 20m)
    ctx.fillStyle = 'var(--text-muted)' in document.documentElement.style
      ? getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
      : '#888';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (let hi = 0; hi < rows; hi++) {
      if ((hi + 1) % 2 === 0) { // every 20m (every 2nd index)
        const y = chartH - (hi + 0.5) * cellH;
        ctx.fillText(`${DISPLAY_HEIGHTS[hi]}m`, LABEL_W - 4, y + 4);
      }
    }

    // X axis labels (every 3 hours)
    ctx.textAlign = 'center';
    for (let t = 0; t < cols; t++) {
      if (t % 3 === 0 && t < grid.times.length) {
        const date = grid.times[hourOffset + t];
        if (!date) continue;
        const label = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const x = LABEL_W + (t + 0.5) * cellW;
        ctx.fillText(label, x, H - 6);
      }
    }
  }

  function resize() {
    if (!canvas) return;
    const parent = canvas.parentElement!;
    canvas.width  = parent.clientWidth;
    canvas.height = Math.round(parent.clientWidth * 0.65); // aspect ratio
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
    padding: 8px 0 0;
  }
  canvas {
    display: block;
    width: 100%;
  }
</style>

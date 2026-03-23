<!-- src/lib/components/TimeSlider.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { WindGrid } from '../types';
  import { nextOffsetFromKey } from '../sliderNavigation';
  import { windColor } from '../stores/settingsStore';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let thresholdKmh: number;
  export let onChange: (offset: number) => void;

  const MAX_OFFSET = 144; // 168h - 24h window

  let trackEl: HTMLDivElement;
  let trackCanvas: HTMLCanvasElement;

  function dayLabel(idx: number): string {
    if (idx >= grid.times.length) return '';
    return grid.times[idx].toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  }

  $: currentLabel = dayLabel(hourOffset);
  $: fillPct = (hourOffset / MAX_OFFSET) * 100;

  function parseRGBA(css: string): [number, number, number, number] {
    const m = css.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)/);
    if (!m) return [0, 0, 0, 1];
    return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
  }

  function toCSS([r, g, b, a]: [number, number, number, number]): string {
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(2)})`;
  }

  function avgWindColor(t: number): string {
    let r = 0, g = 0, b = 0, a = 0;
    const rows = 18;
    for (let hi = 0; hi < rows; hi++) {
      const speed = grid.data[t]?.[hi] ?? 0;
      const [cr, cg, cb, ca] = parseRGBA(windColor(speed, thresholdKmh));
      r += cr; g += cg; b += cb; a += ca;
    }
    return toCSS([r / rows, g / rows, b / rows, Math.min(1, (a / rows) * 1.2)]);
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
    for (let t = 0; t < total; t++) {
      grad.addColorStop(t / (total - 1), avgWindColor(t));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  $: thresholdKmh, drawTrack();

  onMount(() => { drawTrack(); });

  function handlePointer(e: PointerEvent) {
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(Math.round(fraction * MAX_OFFSET));
  }

  function onTrackDown(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointer(e);
  }

  function onTrackKeydown(e: KeyboardEvent) {
    const next = nextOffsetFromKey(e.key, hourOffset, MAX_OFFSET);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  }
</script>

<div class="slider-area">
  <div class="top-row">
    <span class="hint">7-day window · drag to navigate</span>
    <span class="current">{currentLabel}</span>
  </div>

  <div
    class="track"
    bind:this={trackEl}
    on:pointerdown={onTrackDown}
    on:pointermove={e => e.buttons && handlePointer(e)}
    on:keydown={onTrackKeydown}
    role="slider"
    aria-label="Forecast timeline"
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

  <div class="day-ticks">
    {#each Array(7) as _, i}
      <span class="tick">{dayLabel(i * 24).split(' ')[0]}<br>{dayLabel(i * 24).split(' ')[1]}</span>
    {/each}
  </div>
</div>

<style>
  .slider-area { padding: 8px 12px 6px; border-top: 1px solid var(--border); }
  .top-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .hint    { font-size: 11px; color: var(--text-muted); }
  .current { font-size: 12px; font-weight: 600; color: var(--blue); }

  .track {
    position: relative; height: 16px; cursor: pointer;
    display: flex; align-items: center;
    touch-action: none;
  }
  .track-canvas {
    position: absolute; inset: 5px 0;
    border-radius: 4px; pointer-events: none;
  }
  .window-highlight {
    position: absolute; top: 3px; bottom: 3px;
    border: 2px solid rgba(255,255,255,0.75);
    border-radius: 4px; pointer-events: none;
  }
  .thumb {
    position: absolute; width: 16px; height: 16px;
    background: #fff; border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    transform: translateX(-50%);
    pointer-events: none;
  }

  .day-ticks {
    display: flex; justify-content: space-between; margin-top: 6px;
  }
  .tick { font-size: 11px; color: var(--text-muted); text-align: center; line-height: 1.3; }
</style>

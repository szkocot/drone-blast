<!-- src/lib/components/TimeSlider.svelte -->
<script lang="ts">
  import type { WindGrid } from '../types';
  export let grid: WindGrid;
  export let hourOffset: number;
  export let onChange: (offset: number) => void;

  const MAX_OFFSET = 144; // 168h - 24h window

  let trackEl: HTMLDivElement;

  function dayLabel(idx: number): string {
    if (idx >= grid.times.length) return '';
    return grid.times[idx].toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  }

  $: currentLabel = dayLabel(hourOffset);
  $: fillPct = (hourOffset / MAX_OFFSET) * 100;

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
    role="slider"
    aria-valuenow={hourOffset}
    aria-valuemin={0}
    aria-valuemax={MAX_OFFSET}
    tabindex="0"
  >
    <div class="fill" style="width: {fillPct}%"></div>
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
  .hint    { font-size: 9px; color: var(--text-muted); }
  .current { font-size: 10px; font-weight: 600; color: var(--blue); }

  .track {
    position: relative; height: 16px; cursor: pointer;
    display: flex; align-items: center;
    touch-action: none;
  }
  .track::before {
    content: ''; position: absolute; inset: 6px 0;
    background: var(--border); border-radius: 2px;
  }
  .fill {
    position: absolute; left: 0; top: 6px; bottom: 6px;
    background: var(--blue); border-radius: 2px;
    pointer-events: none;
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
  .tick { font-size: 9px; color: var(--text-muted); text-align: center; line-height: 1.3; }
</style>

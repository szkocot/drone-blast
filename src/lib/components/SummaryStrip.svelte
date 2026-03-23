<!-- src/lib/components/SummaryStrip.svelte -->
<script lang="ts">
  import { t } from '../i18n/en';
  import { nowAt10m, peakInWindow, bestFlyingWindow } from '../windGrid';
  import { convertFromKmh, windColor } from '../stores/settingsStore';
  import { DISPLAY_HEIGHTS } from '../types';
  import type { WindGrid, WindUnit } from '../types';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let thresholdKmh: number;
  export let unit: WindUnit;

  $: now    = nowAt10m(grid);
  $: peak   = peakInWindow(grid, hourOffset);
  $: window = bestFlyingWindow(grid, thresholdKmh);

  $: displaySpeed = (kmh: number) => convertFromKmh(kmh, unit).toFixed(0);

  function colorClass(kmh: number): string {
    const r = kmh / thresholdKmh;
    if (r < 0.8) return 'green';
    if (r < 1.0) return 'yellow';
    return 'red';
  }
</script>

<div class="strip">
  <!-- Now @10m -->
  <div class="card {colorClass(now)}">
    <span class="label">{t.nowAt10m}</span>
    <span class="value">{displaySpeed(now)}</span>
    <span class="sub">{unit === 'kmh' ? 'km/h' : unit === 'ms' ? 'm/s' : 'kn'} {now / thresholdKmh < 0.8 ? '✓' : now / thresholdKmh < 1 ? '⚠' : '✗'}</span>
  </div>

  <!-- Peak -->
  <div class="card {peak ? colorClass(peak.speed) : 'green'}">
    <span class="label">{t.peak} · {peak ? DISPLAY_HEIGHTS[peak.heightIndex] : 0}m</span>
    <span class="value">{peak ? displaySpeed(peak.speed) : '—'}</span>
    <span class="sub">{unit === 'kmh' ? 'km/h' : unit === 'ms' ? 'm/s' : 'kn'}</span>
  </div>

  <!-- Best Today -->
  <div class="card {window ? 'green' : 'red'}">
    <span class="label">{window?.mode === 'lowOnly' ? t.bestLow : t.bestToday}</span>
    {#if window}
      <span class="value">{String(window.startHour).padStart(2,'0')}:00</span>
      <span class="sub">{t.hWindow(window.duration)}</span>
    {:else}
      <span class="value">—</span>
      <span class="sub red-text">{t.noWindow}</span>
    {/if}
  </div>
</div>

<style>
  .strip {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
  }

  .card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border-radius: 10px;
    border: 1px solid transparent;
  }
  .card.green  { background: var(--ok-tint); border-color: var(--ok-border); }
  .card.yellow { background: var(--warn-tint);  border-color: var(--warn-border); }
  .card.red    { background: var(--danger-tint); border-color: var(--danger-border); }

  .label { font-size: 12px; font-weight: 600; letter-spacing: 0.4px; color: var(--text-muted); }
  .value { font-size: 22px; font-weight: 800; line-height: 1; color: var(--text); }
  .sub   { font-size: 12px; color: var(--text-muted); }
  .red-text { color: var(--red); }

  .card.green .value  { color: var(--green); }
  .card.yellow .value { color: var(--yellow); }
  .card.red .value    { color: var(--red); }

  @media (min-width: 1024px) {
    .strip {
      gap: 12px;
      padding: 14px 20px 16px;
    }

    .card {
      align-items: flex-start;
      gap: 6px;
      min-height: 112px;
      padding: 14px 16px;
      border-radius: 14px;
    }

    .label {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .value {
      font-size: 28px;
    }

    .sub {
      font-size: 12px;
    }
  }
</style>

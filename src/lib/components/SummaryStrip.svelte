<!-- src/lib/components/SummaryStrip.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { bestFlyingWindow, selectedHourForecast } from '../windGrid';
  import { convertFromKmh } from '../stores/settingsStore';
  import type { WindGrid, WindUnit } from '../types';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let thresholdKmh: number;
  export let maxAltitudeM: number;
  export let unit: WindUnit;

  $: forecast = selectedHourForecast(grid, hourOffset, thresholdKmh, maxAltitudeM);
  $: window = bestFlyingWindow(grid, thresholdKmh, maxAltitudeM);

  $: displaySpeed = (kmh: number) => convertFromKmh(kmh, unit).toFixed(0);

  function colorClass(kmh: number): string {
    const r = kmh / thresholdKmh;
    if (r < 0.8) return 'green';
    if (r < 1.0) return 'yellow';
    return 'red';
  }
</script>

<div class="strip">
  <div class="card hero-card {forecast.verdict === 'fly' ? 'green' : forecast.verdict === 'marginal' ? 'yellow' : 'red'}">
    <span class="label">{$t.selectedHour}</span>
    <span class="value verdict-value">{$t.flightVerdicts[forecast.verdict]}</span>
    <span class="sub">{$t.limitDriver}: {forecast.blockerLabel}</span>
  </div>

  <div class="card {colorClass(forecast.peakWindKmh)}">
    <span class="label">{$t.peak} · {forecast.peakHeightM}m</span>
    <span class="value">{displaySpeed(forecast.peakWindKmh)}</span>
    <span class="sub">{unit === 'kmh' ? 'km/h' : unit === 'ms' ? 'm/s' : 'kn'}</span>
  </div>

  <!-- Best Today -->
  <div class="card {window ? 'green' : 'red'}">
    <span class="label">{window?.mode === 'lowOnly' ? $t.bestLow : $t.bestToday}</span>
    {#if window}
      <span class="value">{String(window.startHour).padStart(2,'0')}:00</span>
      <span class="sub">{$t.hWindow(window.duration)}</span>
    {:else}
      <span class="value">—</span>
      <span class="sub red-text">{$t.noWindow}</span>
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

  .hero-card {
    flex: 1.35;
  }

  .verdict-value {
    font-size: 20px;
    letter-spacing: 0.04em;
  }

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

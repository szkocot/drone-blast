<script lang="ts">
  import { t } from '../i18n';
  import { convertFromKmh, convertTemp } from '../stores/settingsStore';
  import { selectedHourForecast } from '../windGrid';
  import type { KpData, TempUnit, WindGrid, WindUnit } from '../types';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let thresholdKmh: number;
  export let maxAltitudeM: number;
  export let windUnit: WindUnit;
  export let tempUnit: TempUnit;
  export let kpData: KpData | null;
  export let compact = false;

  $: forecast = selectedHourForecast(grid, hourOffset, thresholdKmh, maxAltitudeM);
  $: unitLabel = $t.units[windUnit];
  $: displayWind = (kmh: number) => `${convertFromKmh(kmh, windUnit).toFixed(0)} ${unitLabel}`;
  $: displayTemp = `${convertTemp(forecast.temperatureC, tempUnit).toFixed(0)}${$t.tempUnits[tempUnit]}`;
  $: displayTime = forecast.time.toLocaleString($t.dateLocale, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  $: nearestKp = kpData && kpData.length
    ? kpData.reduce((best, entry) =>
        Math.abs(entry.time.getTime() - forecast.time.getTime()) <
        Math.abs(best.time.getTime() - forecast.time.getTime())
          ? entry
          : best
      )
    : null;
</script>

<section
  class="details-card"
  class:compact
  class:fly={forecast.verdict === 'fly'}
  class:marginal={forecast.verdict === 'marginal'}
  class:nofly={forecast.verdict === 'nofly'}
>
  <div class="header-row">
    <div>
      <p class="eyebrow">{$t.selectedHour}</p>
      <p class="time-label">{displayTime}</p>
    </div>
    <div class="verdict-pill">{$t.flightVerdicts[forecast.verdict]}</div>
  </div>

  <div class="focus-line">
    <strong>{forecast.blockerLabel}</strong>
    <span>{$t.strongestLayer}</span>
  </div>

  <div class="metrics-grid">
    <div class="metric">
      <span class="metric-label">{$t.nowAt10m}</span>
      <strong>{displayWind(forecast.wind10mKmh)}</strong>
    </div>
    <div class="metric">
      <span class="metric-label">{$t.gustsAt10m}</span>
      <strong>{displayWind(forecast.gust10mKmh)}</strong>
    </div>
    <div class="metric">
      <span class="metric-label">{$t.temperature}</span>
      <strong>{displayTemp}</strong>
    </div>
    <div class="metric">
      <span class="metric-label">Kp</span>
      <strong>{nearestKp ? nearestKp.kp.toFixed(0) : '—'}</strong>
    </div>
  </div>
</section>

<style>
  .details-card {
    padding: 16px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background:
      radial-gradient(circle at top right, rgba(74, 158, 255, 0.08), transparent 45%),
      var(--surface2);
  }

  .details-card.fly {
    border-color: var(--ok-border);
    background:
      radial-gradient(circle at top right, var(--ok-tint), transparent 50%),
      var(--surface2);
  }

  .details-card.marginal {
    border-color: var(--warn-border);
    background:
      radial-gradient(circle at top right, var(--warn-tint), transparent 50%),
      var(--surface2);
  }

  .details-card.nofly {
    border-color: var(--danger-border);
    background:
      radial-gradient(circle at top right, var(--danger-tint), transparent 50%),
      var(--surface2);
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .eyebrow,
  .metric-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .time-label {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 800;
    color: var(--text);
  }

  .verdict-pill {
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    border: 1px solid currentColor;
  }

  .fly .verdict-pill {
    color: var(--green);
    background: var(--ok-tint);
  }

  .marginal .verdict-pill {
    color: var(--yellow);
    background: var(--warn-tint);
  }

  .nofly .verdict-pill {
    color: var(--red);
    background: var(--danger-tint);
  }

  .focus-line {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .focus-line strong {
    font-size: 22px;
    font-weight: 900;
    color: var(--text);
  }

  .focus-line span {
    font-size: 12px;
    color: var(--text-muted);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .metric {
    padding: 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
  }

  .metric strong {
    display: block;
    margin-top: 6px;
    font-size: 18px;
    font-weight: 800;
    color: var(--text);
  }

  .compact {
    margin: 10px 12px 0;
    padding: 14px;
  }

  .compact .focus-line strong {
    font-size: 18px;
  }

  .compact .metric {
    padding: 10px;
  }

  .compact .metric strong {
    font-size: 16px;
  }
</style>

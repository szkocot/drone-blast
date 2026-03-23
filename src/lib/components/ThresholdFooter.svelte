<!-- src/lib/components/ThresholdFooter.svelte -->
<script lang="ts">
  import { convertFromKmh } from '../stores/settingsStore';
  import type { WindUnit } from '../types';

  export let thresholdKmh: number;
  export let unit: WindUnit;
  export let onSettings: () => void;

  $: displayVal = convertFromKmh(thresholdKmh, unit).toFixed(0);
  $: unitLabel = unit === 'kmh' ? 'km/h' : unit === 'ms' ? 'm/s' : 'kn';
</script>

<footer class="threshold-footer">
  <div class="footer-meta">
    <div class="threshold">
      <span class="label">Threshold</span>
      <span class="value">{displayVal} {unitLabel}</span>
    </div>

    <div class="legend" aria-label="Wind legend">
      <span class="legend-chip ok">OK</span>
      <span class="legend-chip warn">±20%</span>
      <span class="legend-chip danger">No-fly</span>
    </div>
  </div>

  <button class="settings-btn" on:click={onSettings}>
    <span class="gear" aria-hidden="true">⚙</span>
    <span>Settings</span>
  </button>
</footer>

<style>
  .threshold-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px calc(10px + var(--safe-bottom));
    border-top: 1px solid var(--border);
    background: var(--surface2);
  }

  .footer-meta {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .threshold {
    display: flex;
    gap: 6px;
    align-items: baseline;
    flex-wrap: wrap;
  }

  .label {
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .value {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .legend-chip {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }

  .legend-chip.ok {
    color: var(--green);
    background: rgba(74,255,128,0.08);
    border-color: rgba(74,255,128,0.2);
  }

  .legend-chip.warn {
    color: var(--yellow);
    background: rgba(255,208,50,0.08);
    border-color: rgba(255,208,50,0.2);
  }

  .legend-chip.danger {
    color: var(--red);
    background: rgba(255,60,60,0.08);
    border-color: rgba(255,60,60,0.2);
  }

  .settings-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;
    min-height: 42px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface) 82%, var(--blue) 18%);
    color: var(--text);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .gear {
    font-size: 16px;
    line-height: 1;
  }
</style>

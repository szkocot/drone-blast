<!-- src/lib/components/DesktopUtilityRail.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { convertFromKmh } from '../stores/settingsStore';
  import type { WindUnit } from '../types';

  export let thresholdKmh: number;
  export let unit: WindUnit;
  export let onSettings: () => void;

  $: displayThreshold = convertFromKmh(thresholdKmh, unit).toFixed(0);
  $: unitLabel = $t.units[unit];

  const legendItems = [
    { label: 'OK', tone: 'ok' },
    { label: '±20%', tone: 'caution' },
    { label: 'No-fly', tone: 'nofly' }
  ];
</script>

<aside class="utility-rail" aria-label="Desktop utility rail">
  <div class="rail-section rail-actions">
    <button class="settings-btn" on:click={onSettings}>
      <span class="gear" aria-hidden="true">⚙</span>
      <span>Settings & Units</span>
    </button>
  </div>

  <div class="rail-section">
    <p class="eyebrow">{$t.windThreshold}</p>
    <p class="threshold-value">{displayThreshold} {unitLabel}</p>
    <p class="threshold-note">{$t.thresholdHint}</p>
  </div>

  <div class="rail-section">
    <p class="eyebrow">Legend</p>
    <div class="legend-list">
      {#each legendItems as item}
        <span class="legend-chip {item.tone}">{item.label}</span>
      {/each}
    </div>
  </div>
</aside>

<style>
  .utility-rail {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 12px;
  }

  .rail-section {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface2);
  }

  .rail-actions {
    padding: 0;
    border: none;
    background: transparent;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface2);
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .gear {
    font-size: 18px;
    line-height: 1;
  }

  .eyebrow {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .threshold-value {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
    color: var(--text);
  }

  .threshold-note {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .legend-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .legend-chip {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .legend-chip.ok {
    color: var(--green);
    background: var(--ok-tint);
    border-color: var(--ok-border);
  }

  .legend-chip.caution {
    color: var(--yellow);
    background: var(--warn-tint);
    border-color: var(--warn-border);
  }

  .legend-chip.nofly {
    color: var(--red);
    background: var(--danger-tint);
    border-color: var(--danger-border);
  }
</style>

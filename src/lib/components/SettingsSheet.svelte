<!-- src/lib/components/SettingsSheet.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { convertFromKmh, convertToKmh, thresholdStep } from '../stores/settingsStore';
  import type { Settings, WindUnit, AppAppearance, AppLanguage, TempUnit } from '../types';

  export let settings: Settings;
  export let modelCount: number;
  export let onClose: () => void;
  export let onChange: (s: Partial<Settings>) => void;

  $: displayThreshold = convertFromKmh(settings.thresholdKmh, settings.unit);
  $: step = thresholdStep(settings.unit);

  function increment() {
    const newKmh = Math.min(150, settings.thresholdKmh + step);
    onChange({ thresholdKmh: newKmh });
  }
  function decrement() {
    const newKmh = Math.max(5, settings.thresholdKmh - step);
    onChange({ thresholdKmh: newKmh });
  }

  const units: WindUnit[]       = ['kmh', 'ms', 'knots'];
  const appearances: AppAppearance[] = ['auto', 'light', 'dark'];
  const languages: AppLanguage[] = ['auto', 'en', 'pl'];
  const tempUnits: TempUnit[] = ['celsius', 'fahrenheit'];
</script>

<!-- Backdrop -->
<div class="backdrop" on:click={onClose} role="presentation"></div>

<!-- Sheet -->
<div class="sheet" role="dialog" aria-label={$t.settings}>
  <div class="handle"></div>

  <div class="section">
    <div class="row">
      <div>
        <div class="row-title">{$t.windThreshold}</div>
        <div class="row-hint">{$t.thresholdHint}</div>
      </div>
      <div class="stepper">
        <button on:click={decrement}>−</button>
        <span>{displayThreshold.toFixed(0)} {$t.units[settings.unit]}</span>
        <button on:click={increment}>+</button>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">{$t.windSpeedUnit}</div>
    <div class="seg-group">
      {#each units as u}
        <button class:active={settings.unit === u} on:click={() => onChange({ unit: u })}>
          {$t.units[u]}
        </button>
      {/each}
    </div>
  </div>

  <div class="section">
    <div class="section-label">{$t.language}</div>
    <div class="seg-group">
      {#each languages as lang}
        <button class:active={settings.language === lang}
                on:click={() => onChange({ language: lang })}>
          {$t.languageNames[lang]}
        </button>
      {/each}
    </div>
  </div>

  <div class="section">
    <div class="section-label">{$t.temperature}</div>
    <div class="seg-group">
      {#each tempUnits as tu}
        <button class:active={settings.tempUnit === tu}
                on:click={() => onChange({ tempUnit: tu })}>
          {$t.tempUnits[tu]}
        </button>
      {/each}
    </div>
  </div>

  <div class="section">
    <div class="section-label">{$t.appearance}</div>
    <div class="seg-group">
      {#each appearances as a}
        <button class:active={settings.appearance === a} on:click={() => onChange({ appearance: a })}>
          {$t.appearances[a]}
        </button>
      {/each}
    </div>
  </div>

  <div class="section">
    <div class="row">
      <div>
        <div class="row-title">{$t.dataSources}</div>
        <div class="row-hint">{$t.dataSourcesHint}</div>
      </div>
      <span class="sources" class:ok={modelCount === 6}>{modelCount} / 6 {modelCount === 6 ? '✓' : '⚠'}</span>
    </div>
  </div>

  <div class="section">
    <div class="row">
      <div>
        <div class="row-title">{$t.refetchRadius}</div>
        <div class="row-hint">{$t.refetchRadiusHint}</div>
      </div>
      <div class="stepper">
        <button on:click={() => onChange({ refetchRadiusKm: Math.max(1, settings.refetchRadiusKm - 1) })}>−</button>
        <span>{settings.refetchRadiusKm} km</span>
        <button on:click={() => onChange({ refetchRadiusKm: Math.min(50, settings.refetchRadiusKm + 1) })}>+</button>
      </div>
    </div>
  </div>

  <button class="done-btn" on:click={onClose}>{$t.done}</button>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10;
  }
  .sheet {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 480px;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    border-top: 1px solid var(--border);
    padding: 0 0 calc(16px + var(--safe-bottom));
    z-index: 11;
  }
  .handle {
    width: 36px; height: 4px; background: var(--border);
    border-radius: 2px; margin: 10px auto 8px;
  }
  .section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .section-label { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .row-title { font-size: 14px; color: var(--text); }
  .row-hint  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  .stepper { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .stepper button {
    width: 28px; height: 28px; border-radius: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); font-size: 18px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .stepper span { font-size: 14px; font-weight: 700; color: var(--text); min-width: 60px; text-align: center; }

  .seg-group { display: flex; background: var(--surface2); border-radius: 8px; padding: 2px; gap: 2px; }
  .seg-group button {
    flex: 1; padding: 6px; border-radius: 6px; border: none;
    font-size: 12px; color: var(--text-muted); background: none; cursor: pointer;
  }
  .seg-group button.active {
    background: var(--blue); color: #fff; font-weight: 600;
  }

  .sources { font-size: 13px; font-weight: 600; color: var(--yellow); }
  .sources.ok { color: var(--green); }

  .done-btn {
    display: block; width: calc(100% - 32px); margin: 12px 16px 0;
    padding: 14px; background: var(--blue); color: #fff;
    border: none; border-radius: 12px; font-size: 15px; font-weight: 600;
    cursor: pointer;
  }
</style>

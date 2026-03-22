// src/lib/stores/settingsStore.ts
import { writable } from 'svelte/store';
import type { Settings, WindUnit } from '../types';

const STORAGE_KEY = 'fpvblast-settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults();
}

function defaults(): Settings {
  return { thresholdKmh: 25, unit: 'kmh', appearance: 'auto' };
}

const _store = writable<Settings>(load());

// Persist on every change
_store.subscribe(v => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
});

export const settingsStore = _store;

// Pure helpers (exported for testing)
export function convertFromKmh(kmh: number, unit: WindUnit): number {
  if (unit === 'ms')    return kmh / 3.6;
  if (unit === 'knots') return kmh / 1.852;
  return kmh;
}

export function convertToKmh(value: number, unit: WindUnit): number {
  if (unit === 'ms')    return value * 3.6;
  if (unit === 'knots') return value * 1.852;
  return value;
}

export function thresholdStep(unit: WindUnit): number {
  if (unit === 'ms')    return 3.6;
  if (unit === 'knots') return 1.852;
  return 1;
}

export function windColor(speed: number, thresholdKmh: number): string {
  const ratio = speed / thresholdKmh;
  const opacity = 0.35 + Math.min(ratio / 1.5, 1) * 0.55;
  if (ratio < 0.8) return `rgba(74,255,128,${opacity.toFixed(2)})`;
  if (ratio < 1.0) return `rgba(255,208,50,${opacity.toFixed(2)})`;
  return              `rgba(255,60,60,${opacity.toFixed(2)})`;
}

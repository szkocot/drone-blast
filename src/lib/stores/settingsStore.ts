// src/lib/stores/settingsStore.ts
import { writable } from 'svelte/store';
import type { Settings, WindUnit, TempUnit } from '../types';

const STORAGE_KEY = 'fpvblast-settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults();
}

function defaults(): Settings {
  return { thresholdKmh: 25, unit: 'kmh', appearance: 'auto', refetchRadiusKm: 5, language: 'auto', tempUnit: 'celsius' };
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

export function convertTemp(celsius: number, unit: TempUnit): number {
  return unit === 'fahrenheit' ? celsius * 9 / 5 + 32 : celsius;
}

export function thresholdStep(unit: WindUnit): number {
  if (unit === 'ms')    return 3.6;
  if (unit === 'knots') return 1.852;
  return 1;
}

export function windColor(speed: number, thresholdKmh: number): string {
  const prefersLight =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches;

  const lightTheme =
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-theme') === 'light' ||
      (document.documentElement.getAttribute('data-theme') !== 'dark' && prefersLight));

  const ratio = speed / thresholdKmh;
  const opacity = lightTheme
    ? 0.6 + Math.min(ratio / 1.5, 1) * 0.3
    : 0.35 + Math.min(ratio / 1.5, 1) * 0.55;

  if (lightTheme) {
    if (ratio < 0.8) return `rgba(23,150,87,${opacity.toFixed(2)})`;
    if (ratio < 1.0) return `rgba(183,121,7,${opacity.toFixed(2)})`;
    return              `rgba(195,63,73,${opacity.toFixed(2)})`;
  }

  if (ratio < 0.8) return `rgba(74,255,128,${opacity.toFixed(2)})`;
  if (ratio < 1.0) return `rgba(255,208,50,${opacity.toFixed(2)})`;
  return              `rgba(255,60,60,${opacity.toFixed(2)})`;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

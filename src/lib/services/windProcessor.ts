// src/lib/services/windProcessor.ts
import type { WindGrid } from '../types';

export interface ModelData {
  at10m:       number[];
  at80m:       number[];
  at120m:      number[];
  at180m:      number[];
  temperature: number[];
  weatherCode: number[];
  windGust:    number[];
}

export function removeOutliers(values: number[]): number[] {
  if (values.length < 2) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = sorted.filter(v => v >= lower && v <= upper);
  return filtered.length >= 2 ? filtered : values;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function interpolate(lower: number, upper: number, fraction: number): number {
  return lower + fraction * (upper - lower);
}

export function mode(values: number[]): number {
  if (values.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}

export function buildGrid(models: ModelData[], times: Date[]): WindGrid {
  const hourCount = times.length;
  const data: number[][] = [];
  const temperature: number[] = [];
  const weatherCode: number[] = [];
  const windGust: number[] = [];

  for (let t = 0; t < hourCount; t++) {
    const avg10  = mean(removeOutliers(models.map(m => m.at10m[t]  ?? 0)));
    const avg80  = mean(removeOutliers(models.map(m => m.at80m[t]  ?? 0)));
    const avg120 = mean(removeOutliers(models.map(m => m.at120m[t] ?? 0)));
    const avg180 = mean(removeOutliers(models.map(m => m.at180m[t] ?? 0)));

    const row: number[] = [];
    for (let hIdx = 0; hIdx < 18; hIdx++) {
      const heightM = (hIdx + 1) * 10;
      row.push(interpolateWind(heightM, avg10, avg80, avg120, avg180));
    }
    data.push(row);

    temperature.push(mean(removeOutliers(models.map(m => m.temperature[t] ?? 0))));
    weatherCode.push(mode(models.map(m => m.weatherCode[t] ?? 0)));
    windGust.push(mean(removeOutliers(models.map(m => m.windGust[t] ?? 0))));
  }

  return { data, times, modelCount: models.length, temperature, weatherCode, windGust };
}

function interpolateWind(h: number, v10: number, v80: number, v120: number, v180: number): number {
  if (h <= 10)  return v10;
  if (h <= 80)  return interpolate(v10,  v80,  (h - 10)  / 70);
  if (h <= 120) return interpolate(v80,  v120, (h - 80)  / 40);
  if (h <= 180) return interpolate(v120, v180, (h - 120) / 60);
  return v180;
}

function percentile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

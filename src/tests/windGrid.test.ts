// src/tests/windGrid.test.ts
import { describe, it, expect } from 'vitest';
import {
  bestFlyingWindow,
  currentHourIndex,
  nowAt10m,
  peakInWindow,
  selectedHourForecast,
  sliceGrid,
} from '../lib/windGrid';
import type { WindGrid } from '../lib/types';

function makeGrid(value: number, hours = 48): WindGrid {
  return {
    data: Array.from({ length: hours }, () => Array(18).fill(value)),
    times: Array.from({ length: hours }, (_, i) => new Date(Date.now() + i * 3600000)),
    modelCount: 6,
    temperature: Array(hours).fill(15),
    weatherCode: Array(hours).fill(0),
    windGust: Array(hours).fill(0),
  };
}

describe('sliceGrid', () => {
  it('returns 24 rows', () => {
    const g = makeGrid(10, 168);
    expect(sliceGrid(g, 0).length).toBe(24);
  });
  it('offsets correctly', () => {
    const g = makeGrid(10, 168);
    g.data[24][0] = 99;
    expect(sliceGrid(g, 24)[0][0]).toBe(99);
  });
});

describe('nowAt10m', () => {
  it('returns wind at current hour index 0 (10m)', () => {
    const g = makeGrid(15);
    expect(nowAt10m(g)).toBeCloseTo(15);
  });
});

describe('currentHourIndex', () => {
  it('returns the index matching the current local hour', () => {
    const base = new Date('2026-04-05T20:00:00');
    const g = makeGrid(10, 6);
    g.times = Array.from({ length: 6 }, (_, i) => new Date(base.getTime() + i * 3600000));

    expect(currentHourIndex(g, new Date('2026-04-05T22:31:00'))).toBe(2);
  });
});

describe('peakInWindow', () => {
  it('finds the max value', () => {
    const g = makeGrid(10, 168);
    g.data[5][10] = 99;
    const p = peakInWindow(g, 0);
    expect(p?.speed).toBeCloseTo(99);
    expect(p?.heightIndex).toBe(10);
  });

  it('ignores wind above the configured max altitude', () => {
    const g = makeGrid(10, 168);
    g.data[2][5] = 40;  // 60m
    g.data[2][11] = 90; // 120m

    const p = peakInWindow(g, 0, 60);

    expect(p?.speed).toBeCloseTo(40);
    expect(p?.heightIndex).toBe(5);
  });
});

describe('bestFlyingWindow', () => {
  it('finds contiguous green run (all heights)', () => {
    const g = makeGrid(50, 24); // all windy
    for (let h = 4; h <= 6; h++) g.data[h] = Array(18).fill(5);
    const w = bestFlyingWindow(g, 25);
    expect(w).not.toBeNull();
    expect(w?.startHour).toBe(4);
    expect(w?.duration).toBe(3);
    expect(w?.mode).toBe('allHeights');
  });

  it('falls back to low heights only', () => {
    const g = makeGrid(50, 24);
    for (let h = 6; h <= 9; h++) {
      g.data[h] = Array.from({ length: 18 }, (_, i) => i < 6 ? 5 : 50);
    }
    const w = bestFlyingWindow(g, 25);
    expect(w?.mode).toBe('lowOnly');
  });

  it('returns null when always windy', () => {
    expect(bestFlyingWindow(makeGrid(99, 24), 25)).toBeNull();
  });

  it('uses the configured altitude cap for all-height windows', () => {
    const g = makeGrid(50, 24);
    for (let h = 4; h <= 6; h++) {
      g.data[h] = Array.from({ length: 18 }, (_, i) => i < 6 ? 5 : 50);
    }

    const w = bestFlyingWindow(g, 25, 60);

    expect(w).not.toBeNull();
    expect(w?.startHour).toBe(4);
    expect(w?.duration).toBe(3);
    expect(w?.mode).toBe('allHeights');
  });
});

describe('selectedHourForecast', () => {
  it('summarizes selected-hour wind, gust, temperature, and peak height', () => {
    const g = makeGrid(12, 24);
    g.times[3] = new Date('2026-04-04T15:00:00Z');
    g.data[3][0] = 18;
    g.data[3][5] = 31;
    g.windGust[3] = 27;
    g.temperature[3] = 14;

    expect(selectedHourForecast(g, 3, 35)).toEqual({
      time: new Date('2026-04-04T15:00:00Z'),
      wind10mKmh: 18,
      gust10mKmh: 27,
      temperatureC: 14,
      peakWindKmh: 31,
      peakHeightM: 60,
      verdict: 'marginal',
      blockerLabel: '31 km/h @ 60m',
    });
  });

  it('marks safe and no-fly states from the selected-hour peak wind', () => {
    const safeGrid = makeGrid(10, 24);
    const windyGrid = makeGrid(40, 24);

    expect(selectedHourForecast(safeGrid, 0, 25).verdict).toBe('fly');
    expect(selectedHourForecast(windyGrid, 0, 25).verdict).toBe('nofly');
  });

  it('summarizes selected-hour peak wind only up to the configured max altitude', () => {
    const g = makeGrid(12, 24);
    g.data[1][5] = 28;  // 60m
    g.data[1][11] = 55; // 120m

    const forecast = selectedHourForecast(g, 1, 35, 60);

    expect(forecast.peakWindKmh).toBe(28);
    expect(forecast.peakHeightM).toBe(60);
    expect(forecast.verdict).toBe('marginal');
  });
});

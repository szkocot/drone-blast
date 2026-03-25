// src/tests/windGrid.test.ts
import { describe, it, expect } from 'vitest';
import { sliceGrid, nowAt10m, peakInWindow, bestFlyingWindow } from '../lib/windGrid';
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

describe('peakInWindow', () => {
  it('finds the max value', () => {
    const g = makeGrid(10, 168);
    g.data[5][10] = 99;
    const p = peakInWindow(g, 0);
    expect(p?.speed).toBeCloseTo(99);
    expect(p?.heightIndex).toBe(10);
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
});

// src/tests/windProcessor.test.ts
import { describe, it, expect } from 'vitest';
import {
  removeOutliers, mean, interpolate, buildGrid, mode
} from '../lib/services/windProcessor';

describe('removeOutliers', () => {
  it('keeps all values when no outliers', () => {
    expect(removeOutliers([10, 11, 12, 13, 14]).length).toBe(5);
  });
  it('removes obvious outlier', () => {
    const result = removeOutliers([10, 11, 12, 13, 100]);
    expect(result).not.toContain(100);
  });
  it('returns all when < 2 values', () => {
    expect(removeOutliers([10])).toEqual([10]);
  });
  it('falls back to all values if < 2 remain after removal', () => {
    expect(removeOutliers([1, 1000]).length).toBe(2);
  });
});

describe('mean', () => {
  it('computes correct average', () => {
    expect(mean([10, 20, 30])).toBeCloseTo(20);
  });
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });
});

describe('interpolate', () => {
  it('midpoint', () => expect(interpolate(10, 20, 0.5)).toBeCloseTo(15));
  it('at lower', () => expect(interpolate(10, 20, 0)).toBeCloseTo(10));
  it('at upper', () => expect(interpolate(10, 20, 1)).toBeCloseTo(20));
});

describe('mode', () => {
  it('returns 0 for empty array', () => {
    expect(mode([])).toBe(0);
  });
  it('returns single value', () => {
    expect(mode([3])).toBe(3);
  });
  it('returns most frequent value', () => {
    expect(mode([1, 2, 2, 3])).toBe(2);
  });
  it('returns a winner on tie (any value acceptable)', () => {
    const result = mode([1, 2]);
    expect([1, 2]).toContain(result);
  });
});

describe('buildGrid', () => {
  const makeModelData = (val: number) => ({
    at10m:       Array(2).fill(val),
    at80m:       Array(2).fill(val * 2),
    at120m:      Array(2).fill(val * 3),
    at180m:      Array(2).fill(val * 4),
    temperature: Array(2).fill(20),
    weatherCode: Array(2).fill(0),
    windGust:    Array(2).fill(val),
  });

  it('produces 18 heights per time step', () => {
    const times = [new Date(), new Date(Date.now() + 3600000)];
    const grid = buildGrid([makeModelData(10)], times);
    expect(grid.data[0].length).toBe(18);
    expect(grid.data.length).toBe(2);
  });

  it('height index 0 (10m) equals direct API value', () => {
    const times = [new Date()];
    const grid = buildGrid([makeModelData(10)], times);
    expect(grid.data[0][0]).toBeCloseTo(10); // 10m = direct
  });

  it('height index 7 (80m) equals direct API value', () => {
    const times = [new Date()];
    const grid = buildGrid([makeModelData(10)], times);
    expect(grid.data[0][7]).toBeCloseTo(20); // 80m = 10*2
  });

  it('height index 1 (20m) is interpolated between 10m and 80m', () => {
    const times = [new Date()];
    // 10m=10, 80m=80 → 20m = 10 + (10/70)*(80-10) = 10 + 10 = 20
    const grid = buildGrid([{
      at10m: [10], at80m: [80], at120m: [120], at180m: [180],
      temperature: [15], weatherCode: [0],
      windGust: [12],
    }], times);
    expect(grid.data[0][1]).toBeCloseTo(20, 0);
  });

  it('averages multiple models', () => {
    const times = [new Date()];
    const grid = buildGrid([
      { at10m: [10], at80m: [10], at120m: [10], at180m: [10], temperature: [15], weatherCode: [0], windGust: [10] },
      { at10m: [20], at80m: [20], at120m: [20], at180m: [20], temperature: [15], weatherCode: [0], windGust: [20] },
    ], times);
    expect(grid.data[0][0]).toBeCloseTo(15); // mean of 10 and 20
  });

  it('includes temperature array of correct length', () => {
    const times = [new Date(), new Date(Date.now() + 3600000)];
    const grid = buildGrid([makeModelData(10)], times);
    expect(grid.temperature).toHaveLength(2);
  });

  it('includes weatherCode array of correct length', () => {
    const times = [new Date(), new Date(Date.now() + 3600000)];
    const grid = buildGrid([makeModelData(10)], times);
    expect(grid.weatherCode).toHaveLength(2);
  });

  it('includes windGust array of correct length', () => {
    const times = [new Date(), new Date(Date.now() + 3600000)];
    const grid = buildGrid([makeModelData(10)], times);
    expect(grid.windGust).toHaveLength(2);
  });

  it('averages windGust across models', () => {
    const times = [new Date()];
    const grid = buildGrid([
      { at10m: [10], at80m: [10], at120m: [10], at180m: [10], temperature: [15], weatherCode: [0], windGust: [10] },
      { at10m: [20], at80m: [20], at120m: [20], at180m: [20], temperature: [15], weatherCode: [0], windGust: [20] },
    ], times);
    expect(grid.windGust[0]).toBeCloseTo(15);
  });
});

// src/lib/windGrid.ts
import type { SelectedHourForecast, WindGrid, FlyingWindow, FlightVerdict } from './types';
import { DISPLAY_HEIGHTS, YELLOW_FRACTION } from './types';

export function sliceGrid(grid: WindGrid, hourOffset: number): number[][] {
  const start = Math.max(0, hourOffset);
  return grid.data.slice(start, start + 24);
}

// Returns wind at 10m for the current real-world hour within the grid
export function nowAt10m(grid: WindGrid): number {
  const hourIdx = currentHourIndex(grid);
  return grid.data[hourIdx]?.[0] ?? 0;
}

export function currentHourIndex(grid: WindGrid, now = new Date()): number {
  const idx = grid.times.findIndex(t =>
    t.getFullYear() === now.getFullYear() &&
    t.getMonth() === now.getMonth() &&
    t.getDate() === now.getDate() &&
    t.getHours() === now.getHours()
  );

  return idx >= 0 ? idx : 0;
}

export function heightCountForMaxAltitude(maxAltitudeM = DISPLAY_HEIGHTS[DISPLAY_HEIGHTS.length - 1]): number {
  const count = DISPLAY_HEIGHTS.filter(height => height <= maxAltitudeM).length;
  return Math.max(1, count);
}

export function peakInWindow(
  grid: WindGrid,
  hourOffset: number,
  maxAltitudeM = DISPLAY_HEIGHTS[DISPLAY_HEIGHTS.length - 1]
): { speed: number; heightIndex: number } | null {
  const slice = sliceGrid(grid, hourOffset);
  const heightCount = heightCountForMaxAltitude(maxAltitudeM);
  let max = -Infinity, heightIndex = 0;
  for (const row of slice) {
    for (let hi = 0; hi < Math.min(row.length, heightCount); hi++) {
      if (row[hi] > max) { max = row[hi]; heightIndex = hi; }
    }
  }
  return max === -Infinity ? null : { speed: max, heightIndex };
}

export function bestFlyingWindow(
  grid: WindGrid,
  thresholdKmh: number,
  maxAltitudeM = DISPLAY_HEIGHTS[DISPLAY_HEIGHTS.length - 1]
): FlyingWindow | null {
  const limit = Math.min(24, grid.data.length);
  const greenThreshold = thresholdKmh * YELLOW_FRACTION;
  const heightCount = heightCountForMaxAltitude(maxAltitudeM);

  const allGreen = longestRun(grid.data, limit, 0, heightCount, greenThreshold);
  if (allGreen) return { ...allGreen, mode: 'allHeights' };

  const lowGreen = longestRun(grid.data, limit, 0, Math.min(6, heightCount), greenThreshold);
  if (lowGreen) return { ...lowGreen, mode: 'lowOnly' };

  return null;
}

export function selectedHourForecast(
  grid: WindGrid,
  hourOffset: number,
  thresholdKmh: number,
  maxAltitudeM = DISPLAY_HEIGHTS[DISPLAY_HEIGHTS.length - 1]
): SelectedHourForecast {
  const hourIndex = Math.max(0, Math.min(hourOffset, grid.times.length - 1));
  const row = grid.data[hourIndex] ?? [];
  const heightCount = Math.min(row.length, heightCountForMaxAltitude(maxAltitudeM));
  let peakWindKmh = row[0] ?? 0;
  let peakIndex = 0;

  for (let hi = 1; hi < heightCount; hi++) {
    if (row[hi] > peakWindKmh) {
      peakWindKmh = row[hi];
      peakIndex = hi;
    }
  }

  const ratio = peakWindKmh / thresholdKmh;
  const verdict: FlightVerdict = ratio < YELLOW_FRACTION
    ? 'fly'
    : ratio < 1
      ? 'marginal'
      : 'nofly';
  const peakHeightM = DISPLAY_HEIGHTS[peakIndex] ?? 10;

  return {
    time: grid.times[hourIndex] ?? new Date(0),
    wind10mKmh: row[0] ?? 0,
    gust10mKmh: grid.windGust[hourIndex] ?? 0,
    temperatureC: grid.temperature[hourIndex] ?? 0,
    peakWindKmh,
    peakHeightM,
    verdict,
    blockerLabel: `${peakWindKmh.toFixed(0)} km/h @ ${peakHeightM}m`,
  };
}

function longestRun(
  data: number[][], limit: number,
  hiStart: number, hiEnd: number,
  threshold: number
): { startHour: number; duration: number } | null {
  let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
  for (let h = 0; h < limit; h++) {
    const allGreen = data[h].slice(hiStart, hiEnd).every(v => v < threshold);
    if (allGreen) {
      if (curLen === 0) curStart = h;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curLen = 0;
    }
  }
  return bestLen > 0 ? { startHour: bestStart, duration: bestLen } : null;
}

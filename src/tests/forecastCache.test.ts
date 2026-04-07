import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { read, readOverlaySample, readStale, write, writeOverlaySample } from '../lib/services/forecastCache';
import type { OverlaySample, WindGrid } from '../lib/types';

function makeGrid(overrides: Partial<WindGrid> = {}): WindGrid {
  return {
    data: [[10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44]],
    times: [new Date('2026-03-26T10:00:00Z')],
    modelCount: 4,
    temperature: [15],
    weatherCode: [1],
    windGust: [20],
    ...overrides,
  };
}

function makeOverlaySample(overrides: Partial<OverlaySample> = {}): OverlaySample {
  return {
    lat: 50.06,
    lon: 19.94,
    speedKmh: 14,
    directionDeg: 180,
    fetchedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('read', () => {
  it('returns null when cache is empty', () => {
    expect(read(50, 20)).toBeNull();
  });

  it('returns null when cache is older than 1 hour', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    write(50, 20, makeGrid(), 4);
    vi.setSystemTime(now + 60 * 60 * 1000 + 1); // 1hr + 1ms later
    expect(read(50, 20)).toBeNull();
  });

  it('returns null when current location is more than 5km away', () => {
    write(50, 20, makeGrid(), 4);
    // Cache written for Kraków (50, 20); reading from Warsaw (~252km away)
    expect(read(52.23, 21.01)).toBeNull();
  });

  it('returns the cached entry when fresh and within 5km', () => {
    write(50, 20, makeGrid(), 4);
    const result = read(50, 20);
    expect(result).not.toBeNull();
    expect(result!.modelCount).toBe(4);
  });

  it('returns times as Date objects, not strings', () => {
    write(50, 20, makeGrid(), 4);
    const result = read(50, 20);
    expect(result!.windGrid.times[0]).toBeInstanceOf(Date);
  });

  it('preserves the absolute timestamp through serialization round-trip', () => {
    const original = makeGrid();
    const originalMs = original.times[0].getTime();
    write(50, 20, original, 4);
    const result = read(50, 20);
    expect(result!.windGrid.times[0].getTime()).toBe(originalMs);
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    expect(read(50, 20)).toBeNull();
  });

  it('returns stale cached data when explicitly requested and within 5km', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    write(50, 20, makeGrid(), 4);

    vi.setSystemTime(now + 60 * 60 * 1000 + 1);

    const result = readStale(50, 20);
    expect(result).not.toBeNull();
    expect(result!.modelCount).toBe(4);
    expect(result!.windGrid.times[0]).toBeInstanceOf(Date);
  });
});

describe('write', () => {
  it('does not throw when localStorage.setItem throws (QuotaExceededError)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('QuotaExceededError'); });
    expect(() => write(50, 20, makeGrid(), 4)).not.toThrow();
  });

  it('overwrites previous entry (single slot)', () => {
    write(50, 20, makeGrid({ modelCount: 3 }), 3);
    write(50, 20, makeGrid({ modelCount: 6 }), 6);
    const result = read(50, 20);
    expect(result!.modelCount).toBe(6);
  });
});

describe('overlay cache helpers', () => {
  it('returns null when overlay cache is empty', () => {
    expect(readOverlaySample('overlay:50.1:19.9:hour0')).toBeNull();
  });

  it('round-trips an overlay sample and preserves fetchedAt', () => {
    const sample = makeOverlaySample();
    writeOverlaySample('overlay:50.1:19.9:hour0', sample);

    const result = readOverlaySample('overlay:50.1:19.9:hour0');
    expect(result).not.toBeNull();
    expect(result!.lat).toBe(sample.lat);
    expect(result!.directionDeg).toBe(sample.directionDeg);
    expect(result!.fetchedAt).toBe(sample.fetchedAt);
  });

  it('returns null when overlay cache read throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    expect(readOverlaySample('overlay:50.1:19.9:hour0')).toBeNull();
  });

  it('does not throw when overlay cache write fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('QuotaExceededError'); });
    expect(() => writeOverlaySample('overlay:50.1:19.9:hour0', makeOverlaySample())).not.toThrow();
  });
});

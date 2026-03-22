import { describe, it, expect } from 'vitest';
import { buildUrl, decodeResponse } from '../lib/services/openMeteo';

describe('buildUrl', () => {
  it('includes lat/lon', () => {
    const url = buildUrl(50.06, 19.94, 'ecmwf_ifs04');
    expect(url).toContain('latitude=50.06');
    expect(url).toContain('longitude=19.94');
  });
  it('includes model', () => {
    expect(buildUrl(0, 0, 'gfs_seamless')).toContain('models=gfs_seamless');
  });
  it('includes all 4 height variables', () => {
    const url = buildUrl(0, 0, 'best_match');
    expect(url).toContain('wind_speed_10m');
    expect(url).toContain('wind_speed_80m');
    expect(url).toContain('wind_speed_120m');
    expect(url).toContain('wind_speed_180m');
  });
  it('requests 7 forecast days', () => {
    expect(buildUrl(0, 0, 'best_match')).toContain('forecast_days=7');
  });
});

describe('decodeResponse', () => {
  const json = {
    hourly: {
      time: ['2026-03-23T00:00', '2026-03-23T01:00'],
      wind_speed_10m:  [10.5, 11.0],
      wind_speed_80m:  [20.5, 21.0],
      wind_speed_120m: [25.0, 26.0],
      wind_speed_180m: [30.0, 31.0],
    }
  };
  it('parses wind speeds', () => {
    const r = decodeResponse(json);
    expect(r.at10m[0]).toBeCloseTo(10.5);
    expect(r.at80m[0]).toBeCloseTo(20.5);
  });
  it('parses times as Date objects', () => {
    const r = decodeResponse(json);
    expect(r.times[0]).toBeInstanceOf(Date);
    expect(r.times.length).toBe(2);
  });
});

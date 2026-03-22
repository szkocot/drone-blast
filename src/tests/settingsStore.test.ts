import { describe, it, expect } from 'vitest';

// We test the pure conversion helpers, not the store itself (stores require DOM)
import { convertFromKmh, convertToKmh, thresholdStep, windColor } from '../lib/stores/settingsStore';

describe('convertFromKmh', () => {
  it('kmh passthrough', () => expect(convertFromKmh(36, 'kmh')).toBeCloseTo(36));
  it('to m/s', ()       => expect(convertFromKmh(36, 'ms')).toBeCloseTo(10, 0));
  it('to knots', ()     => expect(convertFromKmh(37, 'knots')).toBeCloseTo(20, 0));
});

describe('convertToKmh', () => {
  it('from m/s', ()     => expect(convertToKmh(10, 'ms')).toBeCloseTo(36, 0));
  it('from knots', ()   => expect(convertToKmh(20, 'knots')).toBeCloseTo(37.04, 0));
});

describe('thresholdStep', () => {
  it('1 for kmh',    () => expect(thresholdStep('kmh')).toBe(1));
  it('3.6 for ms',   () => expect(thresholdStep('ms')).toBeCloseTo(3.6));
  it('1.852 for kn', () => expect(thresholdStep('knots')).toBeCloseTo(1.852));
});

describe('windColor', () => {
  it('returns green when speed < 0.8 × threshold', () => {
    // ratio = 16/25 = 0.64 → opacity = 0.35 + min(0.64/1.5,1)*0.55 = 0.58
    expect(windColor(16, 25)).toBe('rgba(74,255,128,0.58)');
  });

  it('returns yellow when 0.8×threshold ≤ speed < threshold', () => {
    // ratio = 22/25 = 0.88 → opacity = 0.35 + min(0.88/1.5,1)*0.55 = 0.67
    expect(windColor(22, 25)).toBe('rgba(255,208,50,0.67)');
  });

  it('returns red when speed ≥ threshold', () => {
    // ratio = 30/25 = 1.2 → opacity = 0.35 + min(1.2/1.5,1)*0.55 = 0.79
    expect(windColor(30, 25)).toBe('rgba(255,60,60,0.79)');
  });

  it('opacity increases with speed', () => {
    const low  = windColor(5,  25);
    const high = windColor(24, 25);
    const opacityFrom = (s: string) => parseFloat(s.replace(/.*,/, '').replace(')', ''));
    expect(opacityFrom(low)).toBeLessThan(opacityFrom(high));
  });
});

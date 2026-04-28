import { describe, it, expect } from 'vitest';

// We test the pure conversion helpers, not the store itself (stores require DOM)
import {
  convertFromKmh,
  convertToKmh,
  thresholdStep,
  windColor,
  haversineKm,
  convertTemp,
  defaults,
  thresholdForDroneSize,
} from '../lib/stores/settingsStore';

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

describe('haversineKm', () => {
  it('returns ~0 for same point', () => {
    expect(haversineKm(50, 20, 50, 20)).toBeCloseTo(0, 5);
  });

  it('returns ~111 km for 1 degree latitude difference', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 0);
  });

  it('returns ~252 km between Kraków and Warsaw', () => {
    expect(haversineKm(50.06, 19.94, 52.23, 21.01)).toBeCloseTo(252, -1);
  });
});

describe('convertTemp', () => {
  it('returns celsius unchanged', () => {
    expect(convertTemp(20, 'celsius')).toBeCloseTo(20);
  });
  it('converts 0°C to 32°F', () => {
    expect(convertTemp(0, 'fahrenheit')).toBeCloseTo(32);
  });
  it('converts 100°C to 212°F', () => {
    expect(convertTemp(100, 'fahrenheit')).toBeCloseTo(212);
  });
});

describe('defaults', () => {
  it('locationMode defaults to auto', () => {
    expect(defaults().locationMode).toBe('auto');
  });
  it('customLocation defaults to null', () => {
    expect(defaults().customLocation).toBeNull();
  });
  it('keeps the existing full-height analysis by default', () => {
    expect(defaults().maxAltitudeM).toBe(180);
  });
  it('defaults to the freestyle drone profile threshold', () => {
    expect(defaults().droneSize).toBe('freestyle');
    expect(defaults().thresholdKmh).toBe(thresholdForDroneSize('freestyle'));
  });
});

describe('thresholdForDroneSize', () => {
  it('maps smaller drones to lower wind thresholds', () => {
    expect(thresholdForDroneSize('whoop')).toBeLessThan(thresholdForDroneSize('freestyle'));
  });

  it('maps larger drones to higher wind thresholds', () => {
    expect(thresholdForDroneSize('longRange')).toBeGreaterThan(thresholdForDroneSize('freestyle'));
  });
});

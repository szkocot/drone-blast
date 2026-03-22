import { describe, it, expect } from 'vitest';

// We test the pure conversion helpers, not the store itself (stores require DOM)
import { convertFromKmh, convertToKmh, thresholdStep } from '../lib/stores/settingsStore';

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

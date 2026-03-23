import { describe, expect, it } from 'vitest';
import { nextOffsetFromKey } from '../lib/sliderNavigation';

describe('nextOffsetFromKey', () => {
  it('moves one hour with arrow keys', () => {
    expect(nextOffsetFromKey('ArrowRight', 12, 144)).toBe(13);
    expect(nextOffsetFromKey('ArrowLeft', 12, 144)).toBe(11);
  });

  it('moves by six hours with page keys', () => {
    expect(nextOffsetFromKey('PageDown', 12, 144)).toBe(18);
    expect(nextOffsetFromKey('PageUp', 12, 144)).toBe(6);
  });

  it('jumps to bounds with home/end', () => {
    expect(nextOffsetFromKey('Home', 12, 144)).toBe(0);
    expect(nextOffsetFromKey('End', 12, 144)).toBe(144);
  });

  it('returns null for unsupported keys', () => {
    expect(nextOffsetFromKey('Enter', 12, 144)).toBeNull();
  });
});

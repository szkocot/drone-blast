import { describe, expect, it } from 'vitest';
import { decideAutoLocationFailure } from '../lib/startupLocation';

describe('startup location fallback', () => {
  it('opens the map in custom mode when auto location permission is unavailable and no custom location exists', () => {
    expect(decideAutoLocationFailure(null)).toEqual({ type: 'open-map', mode: 'custom' });
  });

  it('keeps using the saved custom location when one exists', () => {
    expect(decideAutoLocationFailure({ lat: 50.1, lon: 20.2, name: 'Saved field' })).toEqual({
      type: 'use-custom',
      location: { lat: 50.1, lon: 20.2, name: 'Saved field' },
    });
  });
});

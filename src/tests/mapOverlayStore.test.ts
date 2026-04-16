import { describe, expect, it, vi } from 'vitest';
import { createMapOverlayController, createMapOverlayService } from '../lib/stores/mapOverlayStore';

describe('map overlay controller', () => {
  it('does not mutate active location when browsing in auto mode', () => {
    const controller = createMapOverlayController({
      initialState: {
        mode: 'auto',
        activeLocation: { lat: 50, lon: 20, name: 'GPS spot' },
        mapCenter: { lat: 50, lon: 20 },
        pendingCustomLocation: null,
        selectedHour: 0,
        overlayState: { type: 'idle' },
      },
    });

    controller.setMode('auto');
    controller.setMapCenter({ lat: 50.1, lon: 19.9 });

    const state = controller.getState();
    expect(state.activeLocation.name).toBe('GPS spot');
    expect(state.mapCenter).toEqual({ lat: 50.1, lon: 19.9 });
    expect(state.pendingCustomLocation).toBeNull();
  });

  it('requires confirm before custom browsing becomes active', () => {
    const controller = createMapOverlayController({
      initialState: {
        mode: 'auto',
        activeLocation: { lat: 50, lon: 20, name: 'GPS spot' },
        mapCenter: { lat: 50, lon: 20 },
        pendingCustomLocation: null,
        selectedHour: 0,
        overlayState: { type: 'idle' },
      },
    });

    controller.setMode('custom');
    controller.setCustomLocation({ lat: 50.5, lon: 20.5, name: 'Field' });

    expect(controller.getState().activeLocation.name).toBe('GPS spot');
    expect(controller.getState().pendingCustomLocation).toEqual({ lat: 50.5, lon: 20.5, name: 'Field' });

    controller.confirmCustomLocation();

    const state = controller.getState();
    expect(state.activeLocation).toEqual({ lat: 50.5, lon: 20.5, name: 'Field' });
    expect(state.pendingCustomLocation).toBeNull();
    expect(state.mode).toBe('custom');
  });

  it('keeps the chosen custom marker when the viewport keeps moving', () => {
    const controller = createMapOverlayController({
      initialState: {
        mode: 'auto',
        activeLocation: { lat: 50, lon: 20, name: 'GPS spot' },
        mapCenter: { lat: 50, lon: 20, name: 'GPS spot' },
        pendingCustomLocation: null,
        selectedHour: 0,
        overlayState: { type: 'idle' },
      },
    });

    controller.setMode('custom');
    controller.setCustomLocation({ lat: 50.2, lon: 20.3, name: 'Launch field' });
    controller.setMapCenter({ lat: 50.8, lon: 20.9, name: 'Viewport only' });

    const state = controller.getState();
    expect(state.mapCenter).toEqual({ lat: 50.8, lon: 20.9, name: 'Viewport only' });
    expect(state.pendingCustomLocation).toEqual({ lat: 50.2, lon: 20.3, name: 'Launch field' });
  });
});

describe('map overlay service', () => {
  it('returns cached samples first and tolerates partial fetch failures', async () => {
    const buildViewportGrid = vi.fn().mockReturnValue([
      { lat: 50, lon: 20 },
      { lat: 50.1, lon: 20.1 },
      { lat: 50.2, lon: 20.2 },
    ]);
    const readOverlaySample = vi.fn((key: string) => (
      key.includes(':0:50:20') ? { lat: 50, lon: 20, speedKmh: 12, directionDeg: 180, fetchedAt: 1 } : null
    ));
    const writeOverlaySample = vi.fn();
    const fetchOverlaySample = vi.fn(async (sample: { lat: number; lon: number }) => {
      if (sample.lat === 50.1) return { ...sample, speedKmh: 14, directionDeg: 190, fetchedAt: 2 };
      if (sample.lat === 50.2) throw new Error('network down');
      throw new Error('unexpected point');
    });

    const service = createMapOverlayService({
      buildViewportGrid,
      readOverlaySample,
      writeOverlaySample,
      fetchOverlaySample,
    });

    const samples = await service.loadViewportOverlay({
      bounds: { north: 51, south: 49, east: 21, west: 19 },
      zoom: 8,
      hourIndex: 0,
    });

    expect(buildViewportGrid).toHaveBeenCalledWith({ north: 51, south: 49, east: 21, west: 19 }, 'medium');
    expect(readOverlaySample).toHaveBeenCalledTimes(3);
    expect(fetchOverlaySample).toHaveBeenCalledTimes(2);
    expect(writeOverlaySample).toHaveBeenCalledTimes(1);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ lat: 50, lon: 20, speedKmh: 12, directionDeg: 180, fetchedAt: 1 });
    expect(samples[1]).toEqual({ lat: 50.1, lon: 20.1, speedKmh: 14, directionDeg: 190, fetchedAt: 2 });
  });
});

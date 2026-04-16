import { get, writable, type Writable } from 'svelte/store';
import type { CustomLocation, ForecastLocation, LocationMode } from '../types';
import {
  createMapOverlayService,
  type LoadViewportOverlayArgs,
  type OverlaySample,
  type OverlayPoint,
} from '../services/mapOverlay';
import { WeatherApiRateLimitError } from '../services/openMeteo';
import { currentTranslations } from '../i18n';

export type MapOverlayMode = LocationMode;

export interface MapOverlayLocation extends ForecastLocation {}

export interface MapOverlayState {
  mode: MapOverlayMode;
  activeLocation: MapOverlayLocation;
  mapCenter: OverlayPoint & { name?: string };
  selectedCustomLocation: MapOverlayLocation | null;
  pendingCustomLocation: MapOverlayLocation | null;
  selectedHour: number;
  overlayState:
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'loaded'; samples: OverlaySample[]; sampleCount: number }
    | { type: 'failed'; message: string };
}

export interface MapOverlayControllerDeps {
  initialState?: Partial<MapOverlayState>;
  overlayService?: ReturnType<typeof createMapOverlayService>;
}

function defaultLocation(): MapOverlayLocation {
  return { lat: 0, lon: 0, name: currentTranslations().gpsSpot };
}

function defaultState(overrides: Partial<MapOverlayState> = {}): MapOverlayState {
  const activeLocation = overrides.activeLocation ?? defaultLocation();
  const mapCenter = overrides.mapCenter ?? { lat: activeLocation.lat, lon: activeLocation.lon, name: activeLocation.name };

  return {
    mode: overrides.mode ?? 'auto',
    activeLocation,
    mapCenter,
    selectedCustomLocation: overrides.selectedCustomLocation ?? null,
    pendingCustomLocation: overrides.pendingCustomLocation ?? null,
    selectedHour: overrides.selectedHour ?? 0,
    overlayState: overrides.overlayState ?? { type: 'idle' },
  };
}

function normalizeLocation(location: CustomLocation | (OverlayPoint & { name?: string }), fallbackName: string): MapOverlayLocation {
  return {
    lat: location.lat,
    lon: location.lon,
    name: location.name?.trim() || fallbackName,
  };
}

function update(store: Writable<MapOverlayState>, patch: Partial<MapOverlayState>): void {
  store.update(state => ({ ...state, ...patch }));
}

export function createMapOverlayController(deps: MapOverlayControllerDeps = {}) {
  const overlayService = deps.overlayService ?? createMapOverlayService();
  const store = writable<MapOverlayState>(defaultState(deps.initialState));

  return {
    subscribe: store.subscribe,
    getState: () => get(store),

    openAtLocation(location: CustomLocation): void {
      const next = normalizeLocation(location, currentTranslations().gpsSpot);
      store.update(state => ({
        ...state,
        activeLocation: next,
        mapCenter: next,
        selectedCustomLocation: null,
        pendingCustomLocation: null,
      }));
    },

    setMode(mode: MapOverlayMode): void {
      store.update(state => ({
        ...state,
        mode,
        selectedCustomLocation: mode === 'custom'
          ? state.selectedCustomLocation ?? normalizeLocation(state.mapCenter, state.activeLocation.name)
          : null,
        pendingCustomLocation: mode === 'custom'
          ? state.pendingCustomLocation ?? state.selectedCustomLocation ?? normalizeLocation(state.mapCenter, state.activeLocation.name)
          : null,
      }));
    },

    setMapCenter(center: OverlayPoint & { name?: string }): void {
      store.update(state => ({
        ...state,
        mapCenter: { ...center },
      }));
    },

    setCustomLocation(location: OverlayPoint & { name?: string }): void {
      store.update(state => {
        const next = normalizeLocation(location, state.activeLocation.name);
        return {
          ...state,
          selectedCustomLocation: next,
          pendingCustomLocation: next,
        };
      });
    },

    setSelectedHour(selectedHour: number): void {
      update(store, { selectedHour });
    },

    confirmCustomLocation(): void {
      store.update(state => {
        const pending = state.pendingCustomLocation;
        if (!pending) return state;
        return {
          ...state,
          mode: 'custom',
          activeLocation: pending,
          mapCenter: { lat: pending.lat, lon: pending.lon, name: pending.name },
          selectedCustomLocation: pending,
          pendingCustomLocation: null,
        };
      });
    },

    async loadOverlayForViewport(args: LoadViewportOverlayArgs): Promise<OverlaySample[]> {
      update(store, { selectedHour: args.hourIndex, overlayState: { type: 'loading' } });

      try {
        const samples = await overlayService.loadViewportOverlay(args);
        store.update(state => ({
          ...state,
          overlayState: { type: 'loaded', samples, sampleCount: samples.length },
        }));
        return samples;
      } catch (error) {
        const message = error instanceof WeatherApiRateLimitError
          ? currentTranslations().overlayRateLimit
          : error instanceof Error
            ? error.message
            : currentTranslations().couldNotLoadOverlay;
        update(store, { overlayState: { type: 'failed', message } });
        return [];
      }
    },
  };
}

export { createMapOverlayService } from '../services/mapOverlay';
export type { OverlaySample, OverlayPoint, LoadViewportOverlayArgs } from '../services/mapOverlay';

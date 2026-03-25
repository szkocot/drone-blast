// src/lib/types.ts

export type WindUnit = 'kmh' | 'ms' | 'knots';
export type AppAppearance = 'auto' | 'light' | 'dark';
export type AppLanguage = 'auto' | 'en' | 'pl';
export type TempUnit = 'celsius' | 'fahrenheit';

export type LocationMode = 'auto' | 'custom';

export interface CustomLocation {
  lat: number;
  lon: number;
  name: string;
}

export interface WindGrid {
  data: number[][];   // [timeIndex 0..167][heightIndex 0..17] = km/h
  times: Date[];      // 168 entries
  modelCount: number;
  temperature: number[];
  weatherCode: number[];
  windGust: number[];  // 168 entries, km/h at 10m
}

export interface KpEntry {
  time: Date;
  kp: number;
}

export type KpData = KpEntry[];

export interface FlyingWindow {
  startHour: number;
  duration: number;
  mode: 'allHeights' | 'lowOnly';
}

export interface Settings {
  thresholdKmh: number;
  unit: WindUnit;
  appearance: AppAppearance;
  refetchRadiusKm: number;
  language: AppLanguage;
  tempUnit: TempUnit;
  locationMode: LocationMode;
  customLocation: CustomLocation | null;
}

export type FetchState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'loaded'; modelCount: number }
  | { type: 'failed'; message: string };

export const DISPLAY_HEIGHTS = Array.from({ length: 18 }, (_, i) => (i + 1) * 10); // [10,20,...,180]
export const API_HEIGHTS = [10, 80, 120, 180];
export const MODELS = ['best_match', 'ecmwf_ifs04', 'gfs_seamless', 'icon_seamless', 'gem_seamless', 'meteofrance_seamless'] as const;
export const YELLOW_FRACTION = 0.8;

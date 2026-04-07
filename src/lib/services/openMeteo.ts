// src/lib/services/openMeteo.ts
import type { ModelData } from './windProcessor';

export class WeatherApiRateLimitError extends Error {
  constructor(message = 'Weather API rate limit exceeded.') {
    super(message);
    this.name = 'WeatherApiRateLimitError';
  }
}

export class WeatherApiUnavailableError extends Error {
  constructor(message = 'Weather API is temporarily unavailable.') {
    super(message);
    this.name = 'WeatherApiUnavailableError';
  }
}

interface DecodedModel extends ModelData {
  times: Date[];
}

export interface OverlayHourData {
  times: Date[];
  speedAt10m: number[];
  speedAt80m: number[];
  directionAt10m: number[];
  directionAt80m: number[];
}

export interface Overlay20mData {
  times: Date[];
  speedAt20m: number[];
  directionAt20m: number[];
}

export function buildUrl(lat: number, lon: number, model: string): string {
  const params = new URLSearchParams({
    latitude:         lat.toFixed(6),
    longitude:        lon.toFixed(6),
    hourly:           'wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,temperature_2m,weather_code,wind_gusts_10m',
    wind_speed_unit:  'kmh',
    forecast_days:    '7',
    models:           model,
    timezone:         'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function buildOverlayUrl(lat: number, lon: number, model: string): string {
  const params = new URLSearchParams({
    latitude:         lat.toFixed(6),
    longitude:        lon.toFixed(6),
    hourly:           'wind_speed_10m,wind_speed_80m,wind_direction_10m,wind_direction_80m',
    wind_speed_unit:  'kmh',
    forecast_days:    '7',
    models:           model,
    timezone:         'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodeResponse(json: any): DecodedModel {
  const h = json.hourly;
  const times = (h.time as string[]).map(s => new Date(s.replace('T', ' ') + ':00'));
  return {
    times,
    at10m:       h.wind_speed_10m   as number[],
    at80m:       h.wind_speed_80m   as number[],
    at120m:      h.wind_speed_120m  as number[],
    at180m:      h.wind_speed_180m  as number[],
    temperature: h.temperature_2m   as number[],
    weatherCode: h.weather_code     as number[],
    windGust:    h.wind_gusts_10m   as number[],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodeOverlayResponse(json: any): OverlayHourData {
  const h = json.hourly;
  const times = (h.time as string[]).map(s => new Date(s.replace('T', ' ') + ':00'));
  return {
    times,
    speedAt10m:     (h.wind_speed_10m as number[]) ?? [],
    speedAt80m:     (h.wind_speed_80m as number[]) ?? [],
    directionAt10m: (h.wind_direction_10m as number[]) ?? [],
    directionAt80m: (h.wind_direction_80m as number[]) ?? [],
  };
}

export function interpolateOverlay20m(input: OverlayHourData): Overlay20mData {
  const fraction = (20 - 10) / (80 - 10);
  const speedAt20m = input.speedAt10m.map((speed10, index) =>
    interpolate(speed10, input.speedAt80m[index] ?? speed10, fraction)
  );
  const directionAt20m = input.directionAt10m.map((dir10, index) =>
    interpolateDirection(dir10, input.directionAt80m[index] ?? dir10, fraction)
  );

  return {
    times: input.times,
    speedAt20m,
    directionAt20m,
  };
}

export async function fetchModel(lat: number, lon: number, model: string): Promise<DecodedModel> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  // Hard deadline via Promise.race — guards against AbortController not firing on some Android WebViews
  const hard = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 9000)
  );

  try {
    const res = await Promise.race([
      fetch(buildUrl(lat, lon, model), { signal: controller.signal }),
      hard,
    ]);
    if (res.status === 429) throw new WeatherApiRateLimitError();
    if (res.status >= 500) throw new WeatherApiUnavailableError(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return decodeResponse(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

function interpolate(lower: number, upper: number, fraction: number): number {
  return lower + fraction * (upper - lower);
}

function interpolateDirection(lower: number, upper: number, fraction: number): number {
  const start = normalizeDegrees(lower);
  const end = normalizeDegrees(upper);
  const delta = ((end - start + 540) % 360) - 180;
  return normalizeDegrees(start + fraction * delta);
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return normalized === 360 ? 0 : normalized;
}

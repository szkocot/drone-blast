// src/lib/services/openMeteo.ts
import type { ModelData } from './windProcessor';

interface DecodedModel extends ModelData {
  times: Date[];
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return decodeResponse(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

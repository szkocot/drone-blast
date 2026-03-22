// src/lib/services/openMeteo.ts
import type { ModelData } from './windProcessor';

interface DecodedModel extends ModelData {
  times: Date[];
}

export function buildUrl(lat: number, lon: number, model: string): string {
  const params = new URLSearchParams({
    latitude:         lat.toFixed(6),
    longitude:        lon.toFixed(6),
    hourly:           'wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m',
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
    at10m:  h.wind_speed_10m  as number[],
    at80m:  h.wind_speed_80m  as number[],
    at120m: h.wind_speed_120m as number[],
    at180m: h.wind_speed_180m as number[],
  };
}

export async function fetchModel(lat: number, lon: number, model: string): Promise<DecodedModel> {
  const res = await fetch(buildUrl(lat, lon, model));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return decodeResponse(await res.json());
}

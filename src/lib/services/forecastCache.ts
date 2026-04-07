import type { OverlaySample, WindGrid } from '../types';

const CACHE_KEY = 'fpv-blast-forecast-cache';
const OVERLAY_CACHE_KEY = 'fpv-blast-overlay-cache';
const TTL_MS = 60 * 60 * 1000; // 1 hour
const PROXIMITY_KM = 5;

interface StoredEntry {
  windGrid: Omit<WindGrid, 'times'> & { times: string[] };
  timestamp: number;
  lat: number;
  lon: number;
  modelCount: number;
}

interface StoredOverlayEntry {
  sample: OverlaySample;
}

interface OverlayCacheLookup {
  hourIndex: number;
  lat: number;
  lon: number;
  maxDistanceDeg: number;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deserializeEntry(entry: StoredEntry): { windGrid: WindGrid; modelCount: number } {
  return {
    windGrid: { ...entry.windGrid, times: entry.windGrid.times.map(s => new Date(s)) },
    modelCount: entry.modelCount,
  };
}

function readEntry(lat: number, lon: number, allowStale: boolean): { windGrid: WindGrid; modelCount: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: StoredEntry = JSON.parse(raw);
    if (!allowStale && Date.now() - entry.timestamp >= TTL_MS) return null;
    if (distanceKm(entry.lat, entry.lon, lat, lon) >= PROXIMITY_KM) return null;
    return deserializeEntry(entry);
  } catch {
    return null;
  }
}

export function read(lat: number, lon: number): { windGrid: WindGrid; modelCount: number } | null {
  return readEntry(lat, lon, false);
}

export function readStale(lat: number, lon: number): { windGrid: WindGrid; modelCount: number } | null {
  return readEntry(lat, lon, true);
}

export function write(lat: number, lon: number, windGrid: WindGrid, modelCount: number): void {
  try {
    const entry: StoredEntry = {
      windGrid: { ...windGrid, times: windGrid.times.map(d => d.toISOString()) },
      timestamp: Date.now(),
      lat,
      lon,
      modelCount,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or unavailable localStorage — degrade gracefully
  }
}

export function readOverlaySample(key: string): OverlaySample | null {
  try {
    const raw = localStorage.getItem(OVERLAY_CACHE_KEY);
    if (!raw) return null;
    const store: Record<string, StoredOverlayEntry> = JSON.parse(raw);
    const entry = store[key];
    if (!entry) return null;
    if (Date.now() - entry.sample.fetchedAt >= TTL_MS) return null;
    return entry.sample;
  } catch {
    return null;
  }
}

export function readNearbyOverlaySample({ hourIndex, lat, lon, maxDistanceDeg }: OverlayCacheLookup): OverlaySample | null {
  try {
    const raw = localStorage.getItem(OVERLAY_CACHE_KEY);
    if (!raw) return null;
    const store: Record<string, StoredOverlayEntry> = JSON.parse(raw);
    const prefix = `overlay:v2:20m:${hourIndex}:`;
    let best: OverlaySample | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [key, entry] of Object.entries(store)) {
      if (!key.startsWith(prefix)) continue;
      if (Date.now() - entry.sample.fetchedAt >= TTL_MS) continue;

      const distance = Math.hypot(entry.sample.lat - lat, entry.sample.lon - lon);
      if (distance > maxDistanceDeg || distance >= bestDistance) continue;

      best = entry.sample;
      bestDistance = distance;
    }

    return best;
  } catch {
    return null;
  }
}

export function writeOverlaySample(key: string, sample: OverlaySample): void {
  try {
    const raw = localStorage.getItem(OVERLAY_CACHE_KEY);
    const store: Record<string, StoredOverlayEntry> = raw ? JSON.parse(raw) : {};
    store[key] = { sample };
    localStorage.setItem(OVERLAY_CACHE_KEY, JSON.stringify(store));
  } catch {
    // QuotaExceededError or unavailable localStorage — degrade gracefully
  }
}

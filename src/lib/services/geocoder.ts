// src/lib/services/geocoder.ts
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    const data = await res.json();
    const city    = data.city || data.locality || '';
    const country = data.countryName || '';
    return [city, country].filter(Boolean).join(', ') || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  } catch {
    return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  }
}

export function weatherIcon(code: number): string {
  if (code === 0)                                return '☀️';
  if (code === 1)                                return '🌤️';
  if (code === 2)                                return '⛅';
  if (code === 3)                                return '☁️';
  if (code === 45 || code === 48)                return '🌫️';
  if (code >= 51 && code <= 57)                  return '🌦️';
  if (code >= 61 && code <= 67)                  return '🌧️';
  if (code >= 71 && code <= 77)                  return '🌨️';
  if (code >= 80 && code <= 82)                  return '🌦️';
  if (code === 85 || code === 86)                return '🌨️';
  if (code === 95 || code === 96 || code === 99) return '⛈️';
  return '🌡️';
}

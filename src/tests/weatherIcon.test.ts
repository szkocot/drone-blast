import { describe, it, expect } from 'vitest';
import { weatherIcon } from '../lib/utils/weatherIcon';

describe('weatherIcon', () => {
  it('clear sky', ()     => expect(weatherIcon(0)).toBe('☀️'));
  it('mainly clear', ()  => expect(weatherIcon(1)).toBe('🌤️'));
  it('partly cloudy', () => expect(weatherIcon(2)).toBe('⛅'));
  it('overcast', ()      => expect(weatherIcon(3)).toBe('☁️'));
  it('fog', ()           => expect(weatherIcon(45)).toBe('🌫️'));
  it('freezing drizzle', () => expect(weatherIcon(56)).toBe('🌦️'));
  it('rain', ()          => expect(weatherIcon(63)).toBe('🌧️'));
  it('freezing rain', () => expect(weatherIcon(66)).toBe('🌧️'));
  it('snow', ()          => expect(weatherIcon(75)).toBe('🌨️'));
  it('thunderstorm', ()  => expect(weatherIcon(95)).toBe('⛈️'));
  it('unknown code', ()  => expect(weatherIcon(999)).toBe('🌡️'));
});

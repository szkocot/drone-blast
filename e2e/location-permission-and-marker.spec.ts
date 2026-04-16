import { test, expect } from '@playwright/test';

const BASE = 'https://localhost:5175/';

function mockForecastPayload() {
  const time = Array.from({ length: 24 }, (_, index) => `2026-04-05T${String(index).padStart(2, '0')}:00`);
  const wind10 = Array.from({ length: 24 }, (_, index) => 12 + (index % 4));
  const wind80 = Array.from({ length: 24 }, (_, index) => 18 + (index % 4));

  return {
    hourly: {
      time,
      wind_speed_10m: wind10,
      wind_speed_80m: wind80,
      wind_speed_120m: wind80.map((value) => value + 3),
      wind_speed_180m: wind80.map((value) => value + 6),
      wind_direction_10m: Array.from({ length: 24 }, () => 180),
      wind_direction_80m: Array.from({ length: 24 }, () => 210),
      temperature_2m: Array.from({ length: 24 }, () => 17),
      weather_code: Array.from({ length: 24 }, () => 1),
      wind_gusts_10m: wind10.map((value) => value + 4),
    },
  };
}

async function mockWeather(page: Parameters<typeof test>[0]['page'], mainFetchCalls: string[]) {
  await page.route('**/v1/forecast**', async (route) => {
    const url = route.request().url();
    if (url.includes('wind_speed_120m')) {
      mainFetchCalls.push(url);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockForecastPayload()),
    });
  });
}

async function mockMapStyle(page: Parameters<typeof test>[0]['page']) {
  await page.route('**/styles/liberty*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#d7e3f4' },
          },
        ],
      }),
    });
  });
}

async function mockReverseGeocode(page: Parameters<typeof test>[0]['page']) {
  await page.route('**/reverse-geocode-client**', async (route) => {
    const url = new URL(route.request().url());
    const lat = Number(url.searchParams.get('latitude') ?? '0');
    const lon = Number(url.searchParams.get('longitude') ?? '0');
    const body = {
      city: `Pinned ${lat.toFixed(2)} ${lon.toFixed(2)}`,
      countryName: 'Poland',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function dragMap(page: Parameters<typeof test>[0]['page'], selector: string) {
  const canvas = page.locator(selector);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('map canvas bounding box missing');

  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.45, { steps: 12 });
  await page.mouse.up();
}

const viewports = [
  {
    name: 'desktop',
    use: { viewport: { width: 1440, height: 1000 } },
  },
  {
    name: 'mobile',
    use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  },
] as const;

for (const variant of viewports) {
  test.describe(variant.name, () => {
    test.use(variant.use);

    test('opens the map on startup when location permission is unavailable', async ({ page }) => {
      const mainFetchCalls: string[] = [];

      await mockWeather(page, mainFetchCalls);
      await mockMapStyle(page);
      await mockReverseGeocode(page);

      await page.addInitScript(() => {
        localStorage.setItem('droneblast-settings', JSON.stringify({
          thresholdKmh: 25,
          unit: 'kmh',
          appearance: 'auto',
          refetchRadiusKm: 5,
          language: 'en',
          tempUnit: 'celsius',
          locationMode: 'auto',
          customLocation: null,
        }));

        const geolocation = {
          getCurrentPosition: (_success: GeolocationPositionCallback, error?: PositionErrorCallback) => {
            error?.({
              code: 1,
              message: 'permission denied',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        };

        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: geolocation,
        });
      });

      await page.goto(BASE);

      await expect(page.getByText(/map ready/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /custom/i })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: /use this spot/i })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.wind-map-shell')).toBeVisible();
      expect(mainFetchCalls).toHaveLength(0);
    });

    test('lets the user place a marker in custom mode and keeps it independent from map panning', async ({ page, context }) => {
      const mainFetchCalls: string[] = [];
      await mockWeather(page, mainFetchCalls);
      await mockMapStyle(page);
      await mockReverseGeocode(page);

      await page.addInitScript(() => {
        localStorage.setItem('droneblast-settings', JSON.stringify({
          thresholdKmh: 25,
          unit: 'kmh',
          appearance: 'auto',
          refetchRadiusKm: 5,
          language: 'en',
          tempUnit: 'celsius',
          locationMode: 'custom',
          customLocation: { lat: 52.23, lon: 21.01, name: 'Saved field' },
        }));
      });

      await page.goto(BASE);
      await expect.poll(() => mainFetchCalls.length).toBeGreaterThan(0);

      await page.getByRole('button', { name: /map/i }).click();
      await expect(page.getByText(/map ready/i)).toBeVisible({ timeout: 10_000 });
      if ((await page.getByRole('button', { name: /custom/i }).getAttribute('aria-pressed')) !== 'true') {
        await page.getByRole('button', { name: /custom/i }).click();
      }
      await expect(page.getByRole('button', { name: /use this spot/i })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /custom/i })).toHaveAttribute('aria-pressed', 'true');

      const mapCanvas = page.locator('.maplibregl-canvas');
      await expect(mapCanvas).toBeVisible({ timeout: 10_000 });

      const canvasBox = await mapCanvas.boundingBox();
      if (!canvasBox) throw new Error('map canvas bounding box missing');

      await mapCanvas.click({
        position: {
          x: canvasBox.width * 0.72,
          y: canvasBox.height * 0.42,
        },
      });

      const marker = page.locator('.selected-marker');
      await expect(marker).toBeVisible({ timeout: 10_000 });

      const beforeDrag = await marker.boundingBox();
      if (!beforeDrag) throw new Error('marker bounding box missing before drag');

      await dragMap(page, '.maplibregl-canvas');
      await page.waitForTimeout(300);

      const afterDrag = await marker.boundingBox();
      if (!afterDrag) throw new Error('marker bounding box missing after drag');

      expect(Math.abs(afterDrag.x - beforeDrag.x)).toBeGreaterThan(10);
    });

    test('shows a marker immediately when switching from auto mode to custom mode', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 52.23, longitude: 21.01 });

      const mainFetchCalls: string[] = [];
      await mockWeather(page, mainFetchCalls);
      await mockMapStyle(page);
      await mockReverseGeocode(page);

      await page.addInitScript(() => {
        localStorage.setItem('droneblast-settings', JSON.stringify({
          thresholdKmh: 25,
          unit: 'kmh',
          appearance: 'auto',
          refetchRadiusKm: 5,
          language: 'en',
          tempUnit: 'celsius',
          locationMode: 'auto',
          customLocation: null,
        }));
      });

      await page.goto(BASE);
      await expect.poll(() => mainFetchCalls.length).toBeGreaterThan(0);

      await page.getByRole('button', { name: /map/i }).click();
      await page.getByRole('button', { name: /custom/i }).click();

      await expect(page.getByRole('button', { name: /custom/i })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.selected-marker')).toBeVisible({ timeout: 10_000 });
    });
  });
}

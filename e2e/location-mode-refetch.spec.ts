import { test, expect } from '@playwright/test';

const BASE = 'https://localhost:5175/fpv-blast/';

test('switching location mode triggers a re-fetch', async ({ page, context }) => {
  // --- grant geolocation and mock GPS position ---
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 52.23, longitude: 21.01 }); // Warsaw

  // Intercept wind API calls and count them
  const fetchCalls: string[] = [];
  await page.route('**/v1/forecast**', (route) => {
    fetchCalls.push(route.request().url());
    route.continue();
  });

  await page.addInitScript(() => {
    localStorage.setItem('fpvblast-settings', JSON.stringify({
      thresholdKmh: 25,
      unit: 'kmh',
      appearance: 'auto',
      refetchRadiusKm: 5,
      language: 'en',
      tempUnit: 'celsius',
      locationMode: 'auto',
      customLocation: { lat: 50.06, lon: 19.94, name: 'Krakow, Poland' }
    }));
  });

  await page.goto(BASE);

  // Wait for initial load to settle
  await page.waitForTimeout(3000);
  const callsAfterMount = fetchCalls.length;
  console.log(`Calls after initial load: ${callsAfterMount}`);
  console.log('URLs:', fetchCalls);

  // Open settings
  await page.getByRole('button', { name: /settings|gear|⚙/i }).first().click();
  await expect(page.locator('.settings-sheet, [class*="sheet"]').first()).toBeVisible({ timeout: 3000 }).catch(() => {});

  // Take screenshot of settings sheet
  await page.screenshot({ path: '/tmp/settings-open.png' });

  // Click "Custom" location mode button
  const customBtn = page.getByRole('button', { name: /custom|własna/i });
  const countBefore = fetchCalls.length;
  console.log(`\nAbout to click Custom. Calls so far: ${countBefore}`);
  await customBtn.click();
  await page.waitForTimeout(2000);
  const countAfterCustom = fetchCalls.length;
  console.log(`After switching to Custom: ${countAfterCustom} total calls (${countAfterCustom - countBefore} new)`);

  // Click "Auto (GPS)" button
  const autoBtn = page.getByRole('button', { name: 'Auto (GPS)' });
  const countBeforeAuto = fetchCalls.length;
  console.log(`\nAbout to click Auto. Calls so far: ${countBeforeAuto}`);
  await autoBtn.click();
  await page.waitForTimeout(2000);
  const countAfterAuto = fetchCalls.length;
  console.log(`After switching to Auto: ${countAfterAuto} total calls (${countAfterAuto - countBeforeAuto} new)`);

  // Final screenshot
  await page.screenshot({ path: '/tmp/after-auto.png' });

  console.log('\n--- SUMMARY ---');
  console.log(`Initial load: ${callsAfterMount} fetch calls`);
  console.log(`After → Custom: +${countAfterCustom - countBefore} fetch calls`);
  console.log(`After → Auto:   +${countAfterAuto - countBeforeAuto} fetch calls`);
  console.log('All intercepted URLs:');
  fetchCalls.forEach((u, i) => console.log(`  [${i}] ${u}`));

  // The bug: switching modes produces 0 new fetch calls
  // This assertion documents what SHOULD happen after the fix:
  expect(countAfterCustom - countBefore, 'switching to Custom should trigger a re-fetch').toBeGreaterThan(0);
  expect(countAfterAuto - countBeforeAuto, 'switching to Auto should trigger a re-fetch').toBeGreaterThan(0);
});

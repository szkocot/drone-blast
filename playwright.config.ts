import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'https://localhost:5175/',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--use-angle=swiftshader',
            '--use-gl=angle',
            '--ignore-gpu-blocklist',
            '--enable-unsafe-swiftshader',
          ],
        },
      },
    },
  ],
});

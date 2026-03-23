// vite.config.ts
import { defineConfig, type PluginOption } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // we provide our own manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [],       // API calls are network-only — no caching
        skipWaiting: true,        // activate new SW immediately, don't wait for tabs to close
        clientsClaim: true,       // take control of all open clients after activation
        cleanupOutdatedCaches: true
      }
    })
  ];

  // HTTPS only in dev — needed for Geolocation API on non-localhost mobile
  if (command === 'serve') {
    const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl');
    plugins.unshift(basicSsl() as PluginOption);
  }

  return {
    base: '/fpv-blast/',
    plugins,
    test: {
      exclude: ['.worktrees/**', 'node_modules/**', 'dist/**', 'e2e/**', 'test-results/**'],
      environment: 'jsdom',
      globals: true
    }
  };
});

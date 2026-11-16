import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { appVersion } from './build-version.ts';

/**
 * Hostnames the dev/preview server will answer to, in addition to localhost.
 * Vite rejects unknown Host headers as a DNS-rebinding safeguard; a leading
 * dot allows a domain and all its subdomains. `.ts.net` covers Tailscale
 * MagicDNS names (open the dev server from your phone on the same tailnet).
 */
const allowedHosts = ['.ts.net'];

/**
 * `vite build --mode android` (npm run build:android) is the bundle the
 * Android app carries in its APK (apps/android): the same app, minus the
 * service worker and manifest. The APK *is* the offline install — the app
 * serves these files from its own assets, and a service worker there would
 * only be a second cache that could serve a stale bundle after an upgrade.
 */
export default defineConfig(({ mode }) => ({
  // Stamp the version into the bundle — the browser has no git to ask.
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    react(),
    VitePWA({
      disable: mode === 'android',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.svg', 'dev-badge.png', 'dev-badge-full.png'],
      manifest: {
        name: 'To Do Matrix',
        short_name: 'To Do Matrix',
        description:
          'A todo list split into four quadrants by importance and urgency.',
        theme_color: '#18181b',
        background_color: '#18181b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        // Long-press shortcuts of the installed PWA — the same #add hook the
        // Android app's launcher shortcuts use (src/launch.ts).
        shortcuts: [
          { name: 'Add to Do', short_name: 'Do', url: '/#add=do' },
          { name: 'Add to Schedule', short_name: 'Schedule', url: '/#add=schedule' },
          { name: 'Add to Delegate', short_name: 'Delegate', url: '/#add=delegate' },
          { name: 'Add to Later', short_name: 'Later', url: '/#add=later' },
        ],
      },
    }),
  ],
  server: { allowedHosts },
  preview: { allowedHosts },
}));

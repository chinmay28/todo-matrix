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

export default defineConfig({
  // Stamp the version into the bundle — the browser has no git to ask.
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    react(),
    VitePWA({
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
      },
    }),
  ],
  server: { allowedHosts },
  preview: { allowedHosts },
});

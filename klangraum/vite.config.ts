/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// base './' = die fertige App läuft in jedem Unterordner (z. B. GitHub Pages oder Firebase Hosting).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Installierbar (Home-Bildschirm) und startet auch ohne Netz. Gespeichert wird nur die App selbst –
    // keine Musik, keine Antworten der Musik-Dienste.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Klangraum',
        short_name: 'Klangraum',
        description:
          'Musik aus freien Quellen, Radio und YouTube – mit Songtexten und eigener Bibliothek.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0c09',
        theme_color: '#0b0c09',
        categories: ['music', 'entertainment'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Suche', url: './#/suche' },
          { name: 'Lieblingssongs', url: './#/bibliothek/lieblingssongs' },
          { name: 'Radio', url: './#/radio' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { host: true },
  build: { target: 'es2020' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});

/// <reference types="vitest/config" />
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// GitHub Pages serves 404.html for any path it doesn't know. Making it a copy
// of index.html lets the client-side router handle deep links and refreshes.
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  // The site is served from https://teodea.github.io/randomizer/
  base: '/randomizer/',
  plugins: [react(), spaFallback()],
  server: {
    // Spotify rejects `localhost` redirect URIs; use the loopback IP instead.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  test: {
    // jsdom is held at 26 in package.json. From 27 on, getComputedStyle — which
    // Testing Library calls for every element whose accessible name it works out,
    // so on every getByRole({ name }) — costs about twice as much, and the page
    // tests take about twice the CPU (the four heaviest files: ~37s on 26, ~70s on
    // 27, ~64s on 30). On a busy machine that pushed the first test of a file,
    // which also pays the worker's cold start, past the 5s timeout. Before moving
    // jsdom up, check that a newer release no longer costs that much.
    environment: 'jsdom',
    // Even on 26, the first page test of a file (a whole generate-and-send flow,
    // run on a cold worker) takes ~1.5s on a quiet machine and has reached ~4s on
    // a loaded one, too close to the default 5s. A hung test still fails, just later.
    testTimeout: 10_000,
    setupFiles: ['./src/test-setup.ts'],
  },
})

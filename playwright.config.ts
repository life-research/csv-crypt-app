import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {defineConfig} from '@playwright/test';

// Runs against both builds: (A) the web app via `vite preview`,
// (B) the single HTML file opened from disk via file://.
export default defineConfig({
  testDir: 'e2e',
  use: {
    channel: 'chrome',
    locale: 'de-DE',
  },
  projects: [
    {name: 'web', use: {baseURL: 'http://localhost:4173/'}},
    {
      name: 'single-file',
      use: {
        baseURL: pathToFileURL(resolve('build-single/csv-crypt.html')).href,
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
  },
});

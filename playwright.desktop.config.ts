import {defineConfig} from '@playwright/test';

// End-to-end test of the Windows executable (e2e-desktop/). The test starts
// the app itself, so there is no browser and no web server here.
export default defineConfig({
  testDir: 'e2e-desktop',
  outputDir: 'test-results/desktop',
  // One app window at a time: the save dialog helper looks for the dialog
  // of one process.
  workers: 1,
  // The cold start of WebView2 on a CI runner can take some seconds.
  timeout: 120_000,
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
});

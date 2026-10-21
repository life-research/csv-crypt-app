import {readFileSync} from 'node:fs';
import {sveltekit} from '@sveltejs/kit/vite';
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-static';
import {defineConfig} from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import {cspDirectives} from './csp.config.ts';

const {version} = JSON.parse(readFileSync('package.json', 'utf8'));

// Build B: one self-contained HTML file that also works from file://.
const singleFile = process.env.BUILD_TARGET === 'single';
// Build C: frontend of the Tauri desktop app. Tauri sets the CSP itself.
const desktop = process.env.BUILD_TARGET === 'desktop';
const outDirs: Record<string, string> = {
  single: 'build-single',
  desktop: 'build-desktop',
};
const outDir = outDirs[process.env.BUILD_TARGET ?? ''] ?? 'build';

const csp = {mode: 'hash' as const, directives: cspDirectives};

export default defineConfig(({command}) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      // One page without server data, so the build ships an SPA shell.
      adapter: adapter({
        pages: outDir,
        assets: outDir,
        fallback: singleFile ? undefined : 'index.html',
      }),
      output: {bundleStrategy: singleFile ? 'inline' : 'split'},
      router: {type: singleFile ? 'hash' : 'pathname'},
      // Only in web builds: the Vite dev server needs a websocket.
      csp: command === 'build' && !desktop ? csp : undefined,
    }),
    tailwindcss(),
  ],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/lib/i18n/*.ts'],
    },
  },
}));

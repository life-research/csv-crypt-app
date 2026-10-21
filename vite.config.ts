import {readFileSync} from 'node:fs';
import {sveltekit} from '@sveltejs/kit/vite';
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-static';
import {defineConfig} from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

const {version} = JSON.parse(readFileSync('package.json', 'utf8'));

// Build B: one self-contained HTML file that also works from file://.
const singleFile = process.env.BUILD_TARGET === 'single';

// The app never talks to any server. The CSP enforces this in the browser.
// It is only active in builds, because the Vite dev server needs a websocket.
const csp = {
  mode: 'hash' as const,
  directives: {
    'default-src': ['none' as const],
    'script-src': ['self' as const],
    'style-src': ['self' as const],
    'img-src': ['self' as const, 'data:' as const],
    'connect-src': ['none' as const],
    'form-action': ['none' as const],
    'base-uri': ['none' as const],
    'object-src': ['none' as const],
  },
};

export default defineConfig(({command}) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      // One page without server data, so the build ships an SPA shell.
      adapter: adapter({
        pages: singleFile ? 'build-single' : 'build',
        assets: singleFile ? 'build-single' : 'build',
        fallback: singleFile ? undefined : 'index.html',
      }),
      output: {bundleStrategy: singleFile ? 'inline' : 'split'},
      router: {type: singleFile ? 'hash' : 'pathname'},
      csp: command === 'build' ? csp : undefined,
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

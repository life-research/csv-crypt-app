// Checks that the desktop app keeps the security rules of the web builds.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {cspDirectives, tauriIpcSources} from '../csp.config.ts';

const config = readJson('src-tauri/tauri.conf.json');
const capability = readJson('src-tauri/capabilities/default.json');

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const cspKeywords = new Set(['none', 'self']);

/** `['self', 'data:']` → `'self' data:` */
function toCspValue(sources: readonly string[]): string {
  return sources
    .map((source) => (cspKeywords.has(source) ? `'${source}'` : source))
    .join(' ');
}

describe('tauri.conf.json', () => {
  it('has the web CSP, with connections only to the Tauri IPC', () => {
    const expected = Object.fromEntries(
      Object.entries({...cspDirectives, 'connect-src': tauriIpcSources}).map(
        ([directive, sources]) => [directive, toCspValue(sources)],
      ),
    );
    expect(config.app.security.csp).toEqual(expected);
  });

  it('serves the desktop build', () => {
    expect(config.build.frontendDist).toBe('../build-desktop');
    expect(config.build.beforeBuildCommand).toBe('npm run build:desktop');
  });

  it('does not expose the Tauri API as a global', () => {
    expect(config.app.withGlobalTauri).toBe(false);
  });

  // The executable's metadata comes from here; code signing needs it.
  it('takes its version from package.json', () => {
    expect(config.version).toBe('../package.json');
  });

  it('sets the product metadata of the executable', () => {
    expect(config.productName).toBe('CSV Crypt');
    expect(config.bundle.publisher).toMatch(/\S/);
    expect(config.bundle.copyright).toContain(config.bundle.publisher);
  });
});

describe('default capability', () => {
  it('allows only the save command', () => {
    expect(capability.permissions).toEqual(['allow-save-file']);
  });
});

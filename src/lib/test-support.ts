// Helpers for tests only.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const FIXTURES = resolve(import.meta.dirname, '../../test/fixtures');

export const TEST_KEY = readFixtureText('key.txt').trim();

export function readFixture(path: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(resolve(FIXTURES, path)));
}

export function readFixtureText(path: string): string {
  return readFileSync(resolve(FIXTURES, path), 'utf8');
}

/** A random source that returns the given bytes, for deterministic tests. */
export function fixedRandom(bytes: Uint8Array<ArrayBuffer>) {
  return (length: number) => bytes.slice(0, length);
}

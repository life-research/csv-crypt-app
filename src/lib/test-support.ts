// Helpers for tests only.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';

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

/**
 * Changes one file in a ZIP archive, for example the XML of a sheet in an
 * .xlsx file, to make cases that write-excel-file cannot write.
 */
export function editZipEntry(
  zip: Uint8Array,
  path: string,
  edit: (text: string) => string,
): Uint8Array<ArrayBuffer> {
  const files = unzipSync(zip);
  files[path] = strToU8(edit(strFromU8(files[path])));
  return zipSync(files) as Uint8Array<ArrayBuffer>;
}

/** Makes `cell` (e.g. `B2`) of the sheet XML an Excel error `#DIV/0!`. */
export function withErrorCell(
  xlsx: Uint8Array,
  sheetPath: string,
  cell: string,
): Uint8Array<ArrayBuffer> {
  return editZipEntry(xlsx, sheetPath, (xml) =>
    xml.replace(
      new RegExp(`<c r="${cell}"[^>]*>.*?</c>`),
      `<c r="${cell}" t="e"><f>1/0</f><v>#DIV/0!</v></c>`,
    ),
  );
}

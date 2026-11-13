// End-to-end test of the Windows executable: the same steps as the browser
// test, but in the desktop app and through its native "Save as" dialog.
// Runs only on Windows, with the path of the executable in CSV_CRYPT_EXE.
import {mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, test as base} from '@playwright/test';
import {decrypt, encrypt} from '../e2e/support/steps';
import {launchApp, type App} from './launch';
import {saveWithDialog} from './save-dialog';

const FIXTURES = resolve('test/fixtures');
const CLEAR_FILE = resolve(FIXTURES, 'input/example-comma-utf8.csv');
const CLEAR_TEXT_SAMPLE = 'longer text with spaces';
const EXPECTED_DECRYPTED = readFileSync(
  resolve(FIXTURES, 'cli/example-comma-utf8.decrypt-utf8.csv'),
);

/**
 * Column 1 of an encrypted file stays readable. Column 2 is Base64, so it
 * contains no separator, and each line is one record.
 */
function firstColumn(encrypted: string): string[] {
  return encrypted
    .trimEnd()
    .split('\n')
    .map((line) => line.split(',')[0]);
}

const test = base.extend<{app: App}>({
  // Playwright requires the object pattern, also without fixtures.
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, use, testInfo) => {
    const executable = process.env.CSV_CRYPT_EXE;
    if (!executable) {
      throw new Error('CSV_CRYPT_EXE is not set');
    }
    const app = await launchApp(resolve(executable));
    try {
      await use(app);
      // The page of the app is not Playwright's own page, so the option
      // `screenshot` does not apply to it.
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('app', {
          body: await app.page.screenshot(),
          contentType: 'image/png',
        });
      }
    } finally {
      await app.close();
    }
  },
});

test('encrypts and decrypts a file in the desktop app', async ({
  app,
}, testInfo) => {
  const {page} = app;
  const saveFile = saveWithDialog(app.processId);
  const directory = testInfo.outputPath();
  mkdirSync(directory, {recursive: true});
  // The app starts in the language of Windows; the shared steps use German.
  await page.getByRole('button', {name: 'de', exact: true}).click();

  const {key, encryptedPath} = await encrypt(
    page,
    CLEAR_FILE,
    saveFile,
    directory,
  );
  expect(encryptedPath).toMatch(/example-comma-utf8_crypt\.csv$/);
  const encrypted = readFileSync(encryptedPath, 'utf8');
  expect(encrypted).not.toContain(CLEAR_TEXT_SAMPLE);
  expect(firstColumn(encrypted)).toEqual(['id', '1', '2', '3', '4', '5']);

  const keyPath = await saveFile(page, 'Als Datei speichern', directory);
  expect(readFileSync(keyPath, 'utf8')).toBe(`${key}\n`);

  const decryptedPath = await decrypt(
    page,
    encryptedPath,
    key,
    saveFile,
    directory,
    'Standard-CSV (UTF-8, Komma)',
  );
  expect(decryptedPath).toMatch(/example-comma-utf8_decrypt\.csv$/);
  expect(readFileSync(decryptedPath)).toEqual(EXPECTED_DECRYPTED);
});

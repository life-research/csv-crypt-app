import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {readWorkbook} from '../src/lib/xlsx/read';
import {writeWorkbook} from '../src/lib/xlsx/write';

const FIXTURES = resolve('test/fixtures');
const CLEAR_FILE = resolve(FIXTURES, 'input/example-comma-utf8.csv');
const CLEAR_TEXT_SAMPLE = 'longer text with spaces';
const EXPECTED_DECRYPTED = readFileSync(
  resolve(FIXTURES, 'cli/example-comma-utf8.decrypt-utf8.csv'),
);

test.beforeEach(async ({page, baseURL}) => {
  // Headless tests cannot use the "Save as" dialog; use the download fallback.
  await page.addInitScript(() => {
    delete (window as {showSaveFilePicker?: unknown}).showSaveFilePicker;
  });
  await page.goto(baseURL!);
});

async function saveDownload(page: Page, buttonName: string): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: buttonName}).click();
  const download = await downloadPromise;
  const path = await download.path();
  return path;
}

/** Like `saveDownload`, but keeps the file name that the app suggests. */
async function saveDownloadAs(
  page: Page,
  buttonName: string,
  directory: string,
): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: buttonName}).click();
  const download = await downloadPromise;
  const path = resolve(directory, download.suggestedFilename());
  await download.saveAs(path);
  return path;
}

async function encrypt(
  page: Page,
): Promise<{key: string; encryptedPath: string}> {
  await page.locator('#encrypt-file').setInputFiles(CLEAR_FILE);
  await page
    .getByRole('button', {name: 'Verschlüsseln', exact: true})
    .last()
    .click();
  await expect(page.getByText('Die Datei ist verschlüsselt.')).toBeVisible();
  const key = (await page
    .locator('.font-mono.select-all')
    .textContent())!.trim();
  const encryptedPath = await saveDownload(
    page,
    'Verschlüsselte Datei speichern',
  );
  return {key, encryptedPath};
}

test('encrypts and decrypts a file in the browser', async ({page}) => {
  const {key, encryptedPath} = await encrypt(page);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
  expect(readFileSync(encryptedPath, 'utf8')).not.toContain(CLEAR_TEXT_SAMPLE);

  await page.getByRole('tab', {name: 'Entschlüsseln'}).click();
  await page.locator('#decrypt-file').setInputFiles(encryptedPath);
  await page.locator('#decrypt-key').fill(key);
  await page.getByLabel('Standard-CSV (UTF-8, Komma)').check();
  await page
    .getByRole('button', {name: 'Entschlüsseln', exact: true})
    .last()
    .click();
  await expect(page.getByText('Die Datei ist entschlüsselt.')).toBeVisible();
  const decryptedPath = await saveDownload(
    page,
    'Entschlüsselte Datei speichern',
  );

  expect(readFileSync(decryptedPath)).toEqual(EXPECTED_DECRYPTED);
});

test('reports a wrong key with the line number', async ({page}) => {
  const {encryptedPath} = await encrypt(page);
  await page.getByRole('tab', {name: 'Entschlüsseln'}).click();
  await page.locator('#decrypt-file').setInputFiles(encryptedPath);
  await page.locator('#decrypt-key').fill('00'.repeat(32));
  await page
    .getByRole('button', {name: 'Entschlüsseln', exact: true})
    .last()
    .click();
  await expect(page.getByRole('alert')).toContainText('Fehler in Zeile 1');
});

test('shows no clear data and stores only the language', async ({page}) => {
  await encrypt(page);
  await expect(page.locator('body')).not.toContainText(CLEAR_TEXT_SAMPLE);
  await page.getByRole('button', {name: 'en', exact: true}).click();
  const storage = await page.evaluate(() => Object.keys(localStorage));
  expect(storage.every((key) => key === 'csv-crypt.language')).toBe(true);
});

test('the CSP blocks all network requests', async ({page}) => {
  const blocked = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/');
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});

test('encrypts and decrypts an Excel file with all sheets', async ({
  page,
}, testInfo) => {
  const original = await writeWorkbook([
    {
      name: 'Patienten',
      rows: [
        ['ID', 'Name', 'Gewicht'],
        ['00123', 'Müller', 72.5],
      ],
    },
    {name: 'Labor', rows: [['00123', 'positiv']]},
  ]);
  const originalPath = testInfo.outputPath('Studie.xlsx');
  writeFileSync(originalPath, original);

  await page.locator('#encrypt-file').setInputFiles(originalPath);
  await expect(
    page.getByText('Excel-Datei: Die App verarbeitet'),
  ).toBeVisible();
  await expect(page.locator('#encrypt-separator')).toHaveCount(0);
  await page
    .getByRole('button', {name: 'Verschlüsseln', exact: true})
    .last()
    .click();
  await expect(page.getByText('2 Blätter · 3 Zeilen')).toBeVisible();
  const key = (await page
    .locator('.font-mono.select-all')
    .textContent())!.trim();
  const encryptedPath = await saveDownloadAs(
    page,
    'Verschlüsselte Datei speichern',
    testInfo.outputPath(),
  );
  expect(encryptedPath).toMatch(/Studie_crypt\.xlsx$/);
  const encrypted = await readWorkbook(readFileSync(encryptedPath));
  expect(encrypted.map(({name}) => name)).toEqual(['Patienten', 'Labor']);
  expect(JSON.stringify(encrypted)).not.toContain('Müller');

  await page.getByRole('tab', {name: 'Entschlüsseln'}).click();
  await page.locator('#decrypt-file').setInputFiles(encryptedPath);
  await page.locator('#decrypt-key').fill(key);
  await page
    .getByRole('button', {name: 'Entschlüsseln', exact: true})
    .last()
    .click();
  await expect(page.getByText('Die Datei ist entschlüsselt.')).toBeVisible();
  const decryptedPath = await saveDownloadAs(
    page,
    'Entschlüsselte Datei speichern',
    testInfo.outputPath(),
  );

  expect(decryptedPath).toMatch(/Studie_decrypt\.xlsx$/);
  expect(await readWorkbook(readFileSync(decryptedPath))).toEqual(
    await readWorkbook(original),
  );
});

test('switches the language', async ({page}) => {
  await page.getByRole('button', {name: 'en', exact: true}).click();
  await expect(page.getByRole('tab', {name: 'Decrypt'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', {name: 'Decrypt'})).toBeVisible();
});

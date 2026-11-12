import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, test, type Page} from '@playwright/test';

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
  // Keeps the suggested name: the app accepts only .csv and .txt files.
  const path = test.info().outputPath(download.suggestedFilename());
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

test('switches the language', async ({page}) => {
  await page.getByRole('button', {name: 'en', exact: true}).click();
  await expect(page.getByRole('tab', {name: 'Decrypt'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', {name: 'Decrypt'})).toBeVisible();
});

/** A CSV file that takes some seconds to encrypt. */
function largeCsv(rows: number): Buffer {
  const lines = Array.from(
    {length: rows},
    (_, i) => `id${i},value ${i},more text ${i}\n`,
  );
  return Buffer.from(lines.join(''));
}

test('locks the file, shows the progress and cancels a large file', async ({
  page,
}) => {
  await page.locator('#encrypt-file').setInputFiles({
    name: 'large.csv',
    mimeType: 'text/csv',
    buffer: largeCsv(300_000),
  });
  await page
    .getByRole('button', {name: 'Verschlüsseln', exact: true})
    .last()
    .click();
  await expect(
    page.getByRole('progressbar', {name: 'Fortschritt'}),
  ).toBeVisible();
  await expect(page.locator('#encrypt-file')).toBeDisabled();
  await page.getByRole('button', {name: 'Abbrechen'}).click();

  await expect(page.getByText('Abgebrochen.')).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeHidden();
  await expect(page.getByText('Die Datei ist verschlüsselt.')).toBeHidden();
  await expect(page.locator('#encrypt-file')).toBeEnabled();
});

test('rejects a file with a wrong extension and keeps the previous file', async ({
  page,
}) => {
  await page.locator('#encrypt-file').setInputFiles(CLEAR_FILE);
  await page.locator('#encrypt-file').setInputFiles({
    name: 'bericht.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
  });

  await expect(page.getByRole('alert')).toContainText(
    'Die App kann die Datei „bericht.pdf“ nicht verarbeiten.',
  );
  await expect(
    page.getByText('Ausgewählt: example-comma-utf8.csv'),
  ).toBeVisible();
});

test('does not encrypt an Excel file with the extension .csv', async ({
  page,
}) => {
  const xlsx = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('[Content_Types].xml xl/workbook.xml'),
  ]);
  await page.locator('#encrypt-file').setInputFiles({
    name: 'studie.csv',
    mimeType: 'text/csv',
    buffer: xlsx,
  });
  await page
    .getByRole('button', {name: 'Verschlüsseln', exact: true})
    .last()
    .click();

  await expect(page.getByRole('alert')).toContainText(
    'Die Datei ist eine Excel-Datei, keine CSV-Datei.',
  );
  await expect(page.getByText('Die Datei ist verschlüsselt.')).toBeHidden();
});

// Steps on the page that the browser and the desktop tests share. Only
// saving differs: a download in the browser, the native dialog in the app.
import {expect, type Page} from '@playwright/test';

/**
 * Clicks the save button and saves the file in `directory`, with the file
 * name that the app suggests. Returns the path of the saved file.
 */
export type SaveFile = (
  page: Page,
  buttonName: string,
  directory: string,
) => Promise<string>;

export async function readKey(page: Page): Promise<string> {
  return (await page.locator('.font-mono.select-all').textContent())!.trim();
}

export async function encrypt(
  page: Page,
  file: string,
  saveFile: SaveFile,
  directory: string,
): Promise<{key: string; encryptedPath: string}> {
  await page.locator('#encrypt-file').setInputFiles(file);
  await page
    .getByRole('button', {name: 'Verschlüsseln', exact: true})
    .last()
    .click();
  await expect(page.getByText('Die Datei ist verschlüsselt.')).toBeVisible();
  const key = await readKey(page);
  const encryptedPath = await saveFile(
    page,
    'Verschlüsselte Datei speichern',
    directory,
  );
  return {key, encryptedPath};
}

export async function decrypt(
  page: Page,
  encryptedPath: string,
  key: string,
  saveFile: SaveFile,
  directory: string,
  outputFormat?: string,
): Promise<string> {
  await page.getByRole('tab', {name: 'Entschlüsseln'}).click();
  await page.locator('#decrypt-file').setInputFiles(encryptedPath);
  await page.locator('#decrypt-key').fill(key);
  if (outputFormat) {
    await page.getByLabel(outputFormat).check();
  }
  await page
    .getByRole('button', {name: 'Entschlüsseln', exact: true})
    .last()
    .click();
  await expect(page.getByText('Die Datei ist entschlüsselt.')).toBeVisible();
  return saveFile(page, 'Entschlüsselte Datei speichern', directory);
}

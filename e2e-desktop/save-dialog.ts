// Saves a file through the native "Save as" dialog of the desktop app.
import {execFile} from 'node:child_process';
import {statSync} from 'node:fs';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {expect} from '@playwright/test';
import type {SaveFile} from '../e2e/support/steps';

const execFileAsync = promisify(execFile);
const SCRIPT = resolve(import.meta.dirname, 'save-dialog.ps1');

export function saveWithDialog(processId: number): SaveFile {
  return async (page, buttonName, directory) => {
    // The click only opens the dialog: the page waits for the Rust side.
    await page.getByRole('button', {name: buttonName}).click();
    const {stdout} = await execFileAsync('pwsh', [
      '-NoProfile',
      '-File',
      SCRIPT,
      '-ProcessId',
      String(processId),
      '-Directory',
      directory,
    ]);
    const path = stdout.trim();
    await waitUntilWritten(path);
    return path;
  };
}

/** The app writes the file after the dialog closed. */
async function waitUntilWritten(path: string): Promise<void> {
  let lastSize = -1;
  await expect
    .poll(() => {
      const size = fileSize(path);
      const unchanged = size > 0 && size === lastSize;
      lastSize = size;
      return unchanged;
    })
    .toBe(true);
}

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return -1;
  }
}

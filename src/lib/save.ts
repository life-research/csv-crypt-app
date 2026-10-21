/**
 * Saves data as a file. Selects the first save method that is available:
 * 1. Desktop app (Tauri): the native "Save as" dialog, through the Rust side.
 * 2. Browsers with a "Save as" dialog (Edge, Chrome): the user selects the folder.
 * 3. Other browsers: download into the default download folder.
 * Must run directly in a click handler (user gesture).
 */
import {invoke, isTauri, type InvokeOptions} from '@tauri-apps/api/core';

export interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
  }) => Promise<{createWritable(): Promise<WritableStreamLike>}>;
}

interface WritableStreamLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export type SaveResult = 'saved' | 'cancelled';
export type SaveMethod = 'tauri' | 'picker' | 'download';

export type TauriInvoke = (
  command: string,
  data: Uint8Array<ArrayBuffer>,
  options: InvokeOptions,
) => Promise<SaveResult>;

/** Must match `FILE_NAME_HEADER` in `src-tauri/src/save.rs`. */
export const FILE_NAME_HEADER = 'x-file-name';

export async function saveFile(
  data: Uint8Array<ArrayBuffer>,
  suggestedName: string,
  mimeType: string,
): Promise<SaveResult> {
  const browserWindow = window as SaveFilePickerWindow;
  switch (chooseSaveMethod(isTauri(), browserWindow)) {
    case 'tauri':
      return saveWithTauri(invoke, data, suggestedName);
    case 'picker':
      return saveWithPicker(
        browserWindow,
        toBlob(data, mimeType),
        suggestedName,
      );
    case 'download':
      downloadBlob(toBlob(data, mimeType), suggestedName);
      return 'saved';
  }
}

export function chooseSaveMethod(
  inTauri: boolean,
  browserWindow: SaveFilePickerWindow,
): SaveMethod {
  if (inTauri) {
    return 'tauri';
  }
  return browserWindow.showSaveFilePicker ? 'picker' : 'download';
}

/** Sends the bytes as raw IPC body; header values must be ASCII. */
export function saveWithTauri(
  tauriInvoke: TauriInvoke,
  data: Uint8Array<ArrayBuffer>,
  suggestedName: string,
): Promise<SaveResult> {
  return tauriInvoke('save_file', data, {
    headers: {[FILE_NAME_HEADER]: encodeURIComponent(suggestedName)},
  });
}

export async function saveWithPicker(
  browserWindow: SaveFilePickerWindow,
  blob: Blob,
  suggestedName: string,
): Promise<SaveResult> {
  try {
    const handle = await browserWindow.showSaveFilePicker!.call(browserWindow, {
      suggestedName,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }
    throw error;
  }
}

function toBlob(data: Uint8Array<ArrayBuffer>, mimeType: string): Blob {
  return new Blob([data], {type: mimeType});
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `data.txt` → `data_crypt.csv` */
export function outputFileName(
  inputName: string,
  suffix: string,
  extension = 'csv',
): string {
  const baseName = inputName.replace(/\.[^.]*$/, '');
  return `${baseName}_${suffix}.${extension}`;
}

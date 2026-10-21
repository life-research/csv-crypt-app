/**
 * Saves data as a file. Uses the "Save as" dialog where the browser has one
 * (Edge, Chrome), so the user selects the folder. Other browsers download
 * the file into the default download folder.
 * Must run directly in a click handler (user gesture).
 */

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
  }) => Promise<{createWritable(): Promise<WritableStreamLike>}>;
}

interface WritableStreamLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export type SaveResult = 'saved' | 'cancelled';

export async function saveFile(
  data: Uint8Array<ArrayBuffer>,
  suggestedName: string,
  mimeType: string,
): Promise<SaveResult> {
  const blob = new Blob([data], {type: mimeType});
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (!picker) {
    downloadBlob(blob, suggestedName);
    return 'saved';
  }
  try {
    const handle = await picker.call(window, {suggestedName});
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

/**
 * Which files the user can select, by file name. This check only stops wrong
 * files early, with a clear message. The app checks the content again when
 * it reads the file (see `csv/content.ts`), because users rename files.
 */

/** `.txt` is Excel's "Unicode Text" (UTF-16, tab). */
export const SUPPORTED_EXTENSIONS = ['csv', 'txt'] as const;

/** For the `accept` attribute of the file input. */
export const ACCEPT = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

const EXCEL_EXTENSIONS = ['xls', 'xlsx', 'xlsm', 'xlsb'];

/** Excel files have their own message: the user can save them as CSV. */
export type FileNameCheck = 'supported' | 'excel' | 'unsupported';

export function checkFileName(name: string): FileNameCheck {
  const extension = fileExtension(name);
  if ((SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)) {
    return 'supported';
  }
  return EXCEL_EXTENSIONS.includes(extension) ? 'excel' : 'unsupported';
}

/** `Studie.CSV` → `csv`; no extension → empty text. */
function fileExtension(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1].toLowerCase() : '';
}

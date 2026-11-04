/**
 * Which files the user can select, by file name. The app reads the content
 * later and checks it again (see `xlsx/kind.ts`); this check only stops
 * wrong files early, with a clear message.
 */

/** `.txt` is Excel's "Unicode Text" (UTF-16, tab). */
export const SUPPORTED_EXTENSIONS = ['csv', 'txt', 'xlsx'] as const;

/** For the `accept` attribute of the file input. */
export const ACCEPT = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/** `xls` has its own message: the user can save the file as .xlsx. */
export type FileNameCheck = 'supported' | 'xls' | 'unsupported';

export function checkFileName(name: string): FileNameCheck {
  const extension = fileExtension(name);
  if ((SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)) {
    return 'supported';
  }
  return extension === 'xls' ? 'xls' : 'unsupported';
}

/** Only for the user interface, before the file is read. */
export function isExcelFileName(name: string): boolean {
  return fileExtension(name) === 'xlsx';
}

/** `Studie.XLSX` → `xlsx`; no extension → empty text. */
function fileExtension(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1].toLowerCase() : '';
}

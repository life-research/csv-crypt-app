/**
 * Tells an Excel file from a text file by its first bytes, not by the file
 * name: users rename files, and Excel saves CSV files with other extensions.
 */
import {startsWithBytes} from '../csv/encoding';

export type InputKind = 'xlsx' | 'xls' | 'text';

/** An .xlsx file is a ZIP archive. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
/** A legacy .xls file is an OLE2 compound file. */
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export class XlsNotSupportedError extends Error {
  constructor() {
    super('Legacy .xls files are not supported');
    this.name = 'XlsNotSupportedError';
  }
}

export function detectInputKind(bytes: Uint8Array): InputKind {
  if (startsWithBytes(bytes, ZIP_SIGNATURE)) {
    return 'xlsx';
  }
  if (startsWithBytes(bytes, OLE_SIGNATURE)) {
    return 'xls';
  }
  return 'text';
}

/** Only for the user interface, before the file is read. */
export function isExcelFileName(name: string): boolean {
  return /\.xlsx$/i.test(name);
}

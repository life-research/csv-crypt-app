/**
 * Encrypts and decrypts all sheets of an .xlsx file. Each sheet keeps its
 * name; its rows have the same format as the lines of an encrypted CSV file:
 * column 1 stays readable, column 2 holds the other columns, encrypted.
 */
import type {CryptoKeys} from '../crypto/key';
import type {DecryptErrorCode} from '../crypto/line';
import type {RandomBytes} from '../crypto/random';
import {decryptRecords, encryptRecords} from '../records';
import {textToCell} from './cells';
import {readWorkbook, type Sheet} from './read';
import {writeWorkbook} from './write';

export interface SheetInfo {
  name: string;
  lineCount: number;
}

export interface WorkbookResult {
  output: Uint8Array<ArrayBuffer>;
  sheets: SheetInfo[];
}

export type DecryptWorkbookResult =
  | ({ok: true} & WorkbookResult)
  | {ok: false; sheet: string; lineNumber: number; error: DecryptErrorCode};

export async function encryptWorkbook(
  input: Uint8Array,
  keys: CryptoKeys,
  random?: RandomBytes,
): Promise<WorkbookResult> {
  const sheets = await readWorkbook(input);
  const encrypted = await Promise.all(
    sheets.map(async ({name, rows}) => ({
      name,
      rows: await encryptRecords(keys, rows, random),
    })),
  );
  return {output: await writeWorkbook(encrypted), sheets: sheetInfos(sheets)};
}

/** Stops at the first row that cannot be decrypted. */
export async function decryptWorkbook(
  input: Uint8Array,
  keys: CryptoKeys,
): Promise<DecryptWorkbookResult> {
  const sheets = await readWorkbook(input);
  const decrypted = [];
  for (const {name, rows} of sheets) {
    const result = await decryptRecords(keys, rows);
    if (!result.ok) {
      return {...result, sheet: name};
    }
    decrypted.push({
      name,
      rows: result.records.map((row) => row.map(textToCell)),
    });
  }
  return {
    ok: true,
    output: await writeWorkbook(decrypted),
    sheets: sheetInfos(sheets),
  };
}

function sheetInfos(sheets: Sheet[]): SheetInfo[] {
  return sheets.map(({name, rows}) => ({name, lineCount: rows.length}));
}

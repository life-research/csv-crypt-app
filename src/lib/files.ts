import {importHexKey} from './crypto/key';
import type {DecryptErrorCode} from './crypto/line';
import type {RandomBytes} from './crypto/random';
import {detectSeparator, parseCsv, writeCsv, type Separator} from './csv/csv';
import {
  decodeInput,
  encodeUtf16LeWithBom,
  encodeUtf8,
  type InputEncoding,
} from './csv/encoding';
import {decryptRecords, encryptRecords} from './records';
import {detectInputKind, XlsNotSupportedError} from './xlsx/kind';
import {
  decryptWorkbook,
  encryptWorkbook,
  type SheetInfo,
} from './xlsx/workbook';

export type SeparatorChoice = Separator | 'auto';

/**
 * `excel`: UTF-16LE with BOM and tab, like the CLI's `--out-optimize-win`.
 * `utf8-comma`: the CLI default.
 * Only for CSV files; an .xlsx file gives an .xlsx file.
 */
export type OutputFormat = 'excel' | 'utf8-comma';

/** The kind of the input file, and so also of the output file. */
export type FileKind = 'csv' | 'xlsx';

export const OUTPUT_TYPES: Record<
  FileKind,
  {extension: string; mimeType: string}
> = {
  csv: {extension: 'csv', mimeType: 'text/csv'},
  xlsx: {
    extension: 'xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

export interface EncryptOptions {
  separator: SeparatorChoice;
  random?: RandomBytes;
}

export interface DecryptOptions {
  separator: SeparatorChoice;
  outputFormat: OutputFormat;
}

export interface CsvInfo {
  kind: 'csv';
  encoding: InputEncoding;
  separator: Separator;
  lineCount: number;
}

export interface WorkbookInfo {
  kind: 'xlsx';
  sheets: SheetInfo[];
}

/** What the app found out about the input file; shown to the user. */
export type InputInfo = CsvInfo | WorkbookInfo;

export interface FileResult {
  output: Uint8Array<ArrayBuffer>;
  input: InputInfo;
}

interface ParsedInput {
  records: string[][];
  info: CsvInfo;
}

export type DecryptFileResult =
  | ({ok: true} & FileResult)
  | {ok: false; sheet?: string; lineNumber: number; error: DecryptErrorCode};

/**
 * Encrypts a whole file. A CSV file gives UTF-8 with comma, like the CLI.
 * An .xlsx file gives an .xlsx file with the same sheets.
 */
export async function encryptFile(
  input: Uint8Array,
  hexKey: string,
  {separator, random}: EncryptOptions,
): Promise<FileResult> {
  const keys = await importHexKey(hexKey);
  if (isWorkbook(input)) {
    const {output, sheets} = await encryptWorkbook(input, keys, random);
    return {output, input: {kind: 'xlsx', sheets}};
  }
  const {records, info} = readRecords(input, separator);
  const encrypted = await encryptRecords(keys, records, random);
  return {output: encodeUtf8(writeCsv(encrypted, ',')), input: info};
}

/** Decrypts a whole file. Stops at the first line that cannot be decrypted. */
export async function decryptFile(
  input: Uint8Array,
  hexKey: string,
  {separator, outputFormat}: DecryptOptions,
): Promise<DecryptFileResult> {
  const keys = await importHexKey(hexKey);
  if (isWorkbook(input)) {
    const result = await decryptWorkbook(input, keys);
    if (!result.ok) {
      return result;
    }
    const {output, sheets} = result;
    return {ok: true, output, input: {kind: 'xlsx', sheets}};
  }
  const {records, info} = readRecords(input, separator);
  const result = await decryptRecords(keys, records);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    output: writeOutput(result.records, outputFormat),
    input: info,
  };
}

/** Throws for a legacy .xls file, which the app cannot read. */
function isWorkbook(input: Uint8Array): boolean {
  const kind = detectInputKind(input);
  if (kind === 'xls') {
    throw new XlsNotSupportedError();
  }
  return kind === 'xlsx';
}

function readRecords(input: Uint8Array, choice: SeparatorChoice): ParsedInput {
  const {text, encoding} = decodeInput(input);
  const separator = choice === 'auto' ? detectSeparator(text) : choice;
  const records = parseCsv(text, separator);
  return {
    records,
    info: {kind: 'csv', encoding, separator, lineCount: records.length},
  };
}

function writeOutput(
  records: string[][],
  format: OutputFormat,
): Uint8Array<ArrayBuffer> {
  return format === 'excel'
    ? encodeUtf16LeWithBom(writeCsv(records, '\t'))
    : encodeUtf8(writeCsv(records, ','));
}

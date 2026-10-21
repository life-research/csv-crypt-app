import {importHexKey} from './crypto/key';
import {decryptLine, encryptLine, type DecryptErrorCode} from './crypto/line';
import type {RandomBytes} from './crypto/random';
import {detectSeparator, parseCsv, writeCsv, type Separator} from './csv/csv';
import {
  decodeInput,
  encodeUtf16LeWithBom,
  encodeUtf8,
  type InputEncoding,
} from './csv/encoding';

export type SeparatorChoice = Separator | 'auto';

/**
 * `excel`: UTF-16LE with BOM and tab, like the CLI's `--out-optimize-win`.
 * `utf8-comma`: the CLI default.
 */
export type OutputFormat = 'excel' | 'utf8-comma';

export interface EncryptOptions {
  separator: SeparatorChoice;
  random?: RandomBytes;
}

export interface DecryptOptions {
  separator: SeparatorChoice;
  outputFormat: OutputFormat;
}

/** What the app found out about the input file; shown to the user. */
export interface InputInfo {
  encoding: InputEncoding;
  separator: Separator;
  lineCount: number;
}

export interface FileResult {
  output: Uint8Array<ArrayBuffer>;
  input: InputInfo;
}

interface ParsedInput {
  records: string[][];
  info: InputInfo;
}

export type DecryptFileResult =
  | ({ok: true} & FileResult)
  | {ok: false; lineNumber: number; error: DecryptErrorCode};

/** Encrypts a whole file. The output is UTF-8 with comma, like the CLI. */
export async function encryptFile(
  input: Uint8Array,
  hexKey: string,
  {separator, random}: EncryptOptions,
): Promise<FileResult> {
  const keys = await importHexKey(hexKey);
  const {records, info} = readRecords(input, separator);
  const encrypted = await Promise.all(
    records.map((record) => encryptLine(keys, record, random)),
  );
  return {output: encodeUtf8(writeCsv(encrypted, ',')), input: info};
}

/** Decrypts a whole file. Stops at the first line that cannot be decrypted. */
export async function decryptFile(
  input: Uint8Array,
  hexKey: string,
  {separator, outputFormat}: DecryptOptions,
): Promise<DecryptFileResult> {
  const keys = await importHexKey(hexKey);
  const {records, info} = readRecords(input, separator);
  const results = await Promise.all(
    records.map((record) => decryptLine(keys, record)),
  );
  const decrypted: string[][] = [];
  for (const [index, result] of results.entries()) {
    if (!result.ok) {
      return {ok: false, lineNumber: index + 1, error: result.error};
    }
    decrypted.push(result.fields);
  }
  return {ok: true, output: writeOutput(decrypted, outputFormat), input: info};
}

function readRecords(input: Uint8Array, choice: SeparatorChoice): ParsedInput {
  const {text, encoding} = decodeInput(input);
  const separator = choice === 'auto' ? detectSeparator(text) : choice;
  const records = parseCsv(text, separator);
  return {records, info: {encoding, separator, lineCount: records.length}};
}

function writeOutput(
  records: string[][],
  format: OutputFormat,
): Uint8Array<ArrayBuffer> {
  return format === 'excel'
    ? encodeUtf16LeWithBom(writeCsv(records, '\t'))
    : encodeUtf8(writeCsv(records, ','));
}

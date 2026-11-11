import {forEachBatch, type BatchOptions} from './batches';
import {importHexKey} from './crypto/key';
import {
  decryptLine,
  encryptLine,
  type DecryptErrorCode,
  type DecryptLineResult,
} from './crypto/line';
import type {RandomBytes} from './crypto/random';
import {
  detectSeparator,
  readCsv,
  type CsvRecord,
  type Separator,
} from './csv/csv';
import {decodeInput, type InputEncoding} from './csv/encoding';
import {CsvOutput, UTF16LE_WITH_BOM, UTF8} from './csv/output';
import {
  assertInputSize,
  MAX_ENCRYPT_OUTPUT_BYTES,
  type Operation,
} from './limits';

export type SeparatorChoice = Separator | 'auto';

/**
 * `excel`: UTF-16LE with BOM and tab, like the CLI's `--out-optimize-win`.
 * `utf8-comma`: the CLI default.
 */
export type OutputFormat = 'excel' | 'utf8-comma';

export interface EncryptOptions extends BatchOptions {
  separator: SeparatorChoice;
  random?: RandomBytes;
}

export interface DecryptOptions extends BatchOptions {
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

/** The records are read lazily, while the batches are processed. */
interface OpenedInput {
  records: Iterable<CsvRecord>;
  textLength: number;
  encoding: InputEncoding;
  separator: Separator;
}

type DecryptFailure = {
  ok: false;
  lineNumber: number;
  error: DecryptErrorCode;
};

export type DecryptFileResult = ({ok: true} & FileResult) | DecryptFailure;

/** Encrypts a whole file. The output is UTF-8 with comma, like the CLI. */
export async function encryptFile(
  input: Uint8Array,
  hexKey: string,
  {separator, random, ...batchOptions}: EncryptOptions,
): Promise<FileResult> {
  const keys = await importHexKey(hexKey);
  const opened = openInput(input, separator, 'encrypt');
  const output = new CsvOutput(',', UTF8, MAX_ENCRYPT_OUTPUT_BYTES);
  const lineCount = await forEachBatch(
    opened.records,
    opened.textLength,
    async (records) => {
      output.write(
        await Promise.all(
          records.map((record) => encryptLine(keys, record, random)),
        ),
      );
      return true;
    },
    batchOptions,
  );
  return {output: output.finish(), input: inputInfo(opened, lineCount)};
}

/** Decrypts a whole file. Stops at the first line that cannot be decrypted. */
export async function decryptFile(
  input: Uint8Array,
  hexKey: string,
  {separator, outputFormat, ...batchOptions}: DecryptOptions,
): Promise<DecryptFileResult> {
  const keys = await importHexKey(hexKey);
  const opened = openInput(input, separator, 'decrypt');
  const output = new CsvOutput(...OUTPUT_FORMATS[outputFormat]);
  let failure: DecryptFailure | null = null;
  const lineCount = await forEachBatch(
    opened.records,
    opened.textLength,
    async (records, firstIndex) => {
      const results = await Promise.all(
        records.map((record) => decryptLine(keys, record)),
      );
      const checked = checkBatch(results, firstIndex);
      if (!checked.ok) {
        failure = checked;
        return false;
      }
      output.write(checked.records);
      return true;
    },
    batchOptions,
  );
  return (
    failure ?? {
      ok: true,
      output: output.finish(),
      input: inputInfo(opened, lineCount),
    }
  );
}

const OUTPUT_FORMATS: Record<
  OutputFormat,
  ConstructorParameters<typeof CsvOutput>
> = {
  excel: ['\t', UTF16LE_WITH_BOM],
  'utf8-comma': [',', UTF8],
};

function openInput(
  input: Uint8Array,
  choice: SeparatorChoice,
  operation: Operation,
): OpenedInput {
  assertInputSize(input.length, operation);
  const {text, encoding} = decodeInput(input);
  const separator = choice === 'auto' ? detectSeparator(text) : choice;
  return {
    records: readCsv(text, separator),
    textLength: text.length,
    encoding,
    separator,
  };
}

function inputInfo(
  {encoding, separator}: OpenedInput,
  lineCount: number,
): InputInfo {
  return {encoding, separator, lineCount};
}

/**
 * The decrypted records of a batch, or its first failed line, numbered from 1
 * in the whole file.
 */
function checkBatch(
  results: DecryptLineResult[],
  firstIndex: number,
): {ok: true; records: string[][]} | DecryptFailure {
  const records: string[][] = [];
  for (const [index, result] of results.entries()) {
    if (!result.ok) {
      return {
        ok: false,
        lineNumber: firstIndex + index + 1,
        error: result.error,
      };
    }
    records.push(result.fields);
  }
  return {ok: true, records};
}

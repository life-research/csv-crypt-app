/**
 * Encrypts and decrypts tables of text, row by row. CSV files and the sheets
 * of Excel files both use this, so their rows have the same format.
 */
import type {CryptoKeys} from './crypto/key';
import {decryptLine, encryptLine, type DecryptErrorCode} from './crypto/line';
import type {RandomBytes} from './crypto/random';

export type DecryptRecordsResult =
  | {ok: true; records: string[][]}
  | {ok: false; lineNumber: number; error: DecryptErrorCode};

export function encryptRecords(
  keys: CryptoKeys,
  records: string[][],
  random?: RandomBytes,
): Promise<string[][]> {
  return Promise.all(
    records.map((record) => encryptLine(keys, record, random)),
  );
}

/** Stops at the first row that cannot be decrypted. */
export async function decryptRecords(
  keys: CryptoKeys,
  records: string[][],
): Promise<DecryptRecordsResult> {
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
  return {ok: true, records: decrypted};
}

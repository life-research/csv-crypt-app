/**
 * Size limits, from measurements in Chrome (see the README, "File size").
 * The units are MiB; the user interface calls them MB.
 */

export const MIB = 1024 * 1024;

/** Larger files take minutes and several GB of memory in the browser. */
export const MAX_ENCRYPT_INPUT_BYTES = 200 * MIB;

/**
 * Chrome decodes at most 536,870,888 characters into one text; with more,
 * it gives an empty text without an error. An encrypted file contains only
 * ASCII characters, so its size in bytes is its length in characters.
 */
export const MAX_DECRYPT_INPUT_BYTES = 500 * MIB;

/** An encrypted file must stay small enough to be decrypted again. */
export const MAX_ENCRYPT_OUTPUT_BYTES = MAX_DECRYPT_INPUT_BYTES;

export type Operation = 'encrypt' | 'decrypt';

const MAX_INPUT_BYTES: Record<Operation, number> = {
  encrypt: MAX_ENCRYPT_INPUT_BYTES,
  decrypt: MAX_DECRYPT_INPUT_BYTES,
};

/** The input file is larger than the app can process. */
export class FileTooLargeError extends Error {
  constructor(
    readonly size: number,
    readonly maxSize: number,
  ) {
    super(`The file has ${size} bytes; the maximum is ${maxSize} bytes.`);
    this.name = 'FileTooLargeError';
  }
}

/** The output would be larger than the app can read again. */
export class OutputTooLargeError extends Error {
  constructor(readonly maxSize: number) {
    super(`The output would be larger than ${maxSize} bytes.`);
    this.name = 'OutputTooLargeError';
  }
}

/** Throws `FileTooLargeError` before the app reads a file that is too large. */
export function assertInputSize(size: number, operation: Operation): void {
  const maxSize = MAX_INPUT_BYTES[operation];
  if (size > maxSize) {
    throw new FileTooLargeError(size, maxSize);
  }
}

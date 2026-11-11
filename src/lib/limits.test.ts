import {describe, expect, it} from 'vitest';
import {
  assertInputSize,
  FileTooLargeError,
  MAX_DECRYPT_INPUT_BYTES,
  MAX_ENCRYPT_INPUT_BYTES,
  MAX_ENCRYPT_OUTPUT_BYTES,
  MIB,
} from './limits';

/** Chrome's maximum string length (V8 on 64-bit systems). */
const CHROME_MAX_STRING_LENGTH = 536_870_888;

describe('limits', () => {
  it('has the measured values', () => {
    expect(MAX_ENCRYPT_INPUT_BYTES).toBe(200 * MIB);
    expect(MAX_DECRYPT_INPUT_BYTES).toBe(500 * MIB);
  });

  it('keeps every file that the app decrypts below the string limit', () => {
    expect(MAX_DECRYPT_INPUT_BYTES).toBeLessThan(CHROME_MAX_STRING_LENGTH);
  });

  it('writes only encrypted files that the app can decrypt again', () => {
    expect(MAX_ENCRYPT_OUTPUT_BYTES).toBeLessThanOrEqual(
      MAX_DECRYPT_INPUT_BYTES,
    );
  });
});

describe('assertInputSize', () => {
  it.each([
    ['encrypt', MAX_ENCRYPT_INPUT_BYTES],
    ['decrypt', MAX_DECRYPT_INPUT_BYTES],
  ] as const)('accepts a file up to the limit (%s)', (operation, max) => {
    expect(() => assertInputSize(0, operation)).not.toThrow();
    expect(() => assertInputSize(max, operation)).not.toThrow();
  });

  it.each([
    ['encrypt', MAX_ENCRYPT_INPUT_BYTES],
    ['decrypt', MAX_DECRYPT_INPUT_BYTES],
  ] as const)('rejects a larger file (%s)', (operation, max) => {
    expect(() => assertInputSize(max + 1, operation)).toThrow(
      new FileTooLargeError(max + 1, max),
    );
    expect(() => assertInputSize(max + 1, operation)).toThrow(
      expect.objectContaining({size: max + 1, maxSize: max}),
    );
  });
});

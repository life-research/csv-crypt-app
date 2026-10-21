import {describe, expect, it} from 'vitest';
import {outputFileName} from './save';

describe('outputFileName', () => {
  it.each([
    ['data.txt', 'crypt', 'data_crypt.csv'],
    ['data.crypt.csv', 'decrypt', 'data.crypt_decrypt.csv'],
    ['noext', 'crypt', 'noext_crypt.csv'],
  ])('%s + %s → %s', (input, suffix, expected) => {
    expect(outputFileName(input, suffix)).toBe(expected);
  });

  it('uses the given extension', () => {
    expect(outputFileName('data.txt', 'key', 'txt')).toBe('data_key.txt');
  });
});

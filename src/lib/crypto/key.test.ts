import {describe, expect, it} from 'vitest';
import {
  generateHexKey,
  importHexKey,
  InvalidKeyError,
  isValidHexKey,
} from './key';

describe('generateHexKey', () => {
  it('makes 64 lowercase hex characters', () => {
    expect(generateHexKey()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('makes a different key each time', () => {
    expect(generateHexKey()).not.toBe(generateHexKey());
  });

  it('uses the injected random source', () => {
    const random = (length: number) => new Uint8Array(length).fill(0xab);
    expect(generateHexKey(random)).toBe('ab'.repeat(32));
  });
});

describe('isValidHexKey', () => {
  it.each([
    ['ab'.repeat(32), true],
    ['AB'.repeat(32), true],
    [`  ${'ab'.repeat(32)}\n`, true],
    ['ab'.repeat(31), false],
    ['ab'.repeat(33), false],
    ['zz'.repeat(32), false],
    ['', false],
  ])('%j → %s', (key, expected) => {
    expect(isValidHexKey(key)).toBe(expected);
  });
});

describe('importHexKey', () => {
  it('imports a valid key', async () => {
    const keys = await importHexKey('00'.repeat(32));
    expect(keys.macKey.algorithm.name).toBe('HMAC');
    expect(keys.encKey.algorithm.name).toBe('AES-CBC');
  });

  it('rejects an invalid key', async () => {
    await expect(importHexKey('nope')).rejects.toBeInstanceOf(InvalidKeyError);
  });
});

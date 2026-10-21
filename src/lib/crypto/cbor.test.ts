import {describe, expect, it} from 'vitest';
import {CborError, decodeStringArray, encodeStringArray} from './cbor';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const fromHex = (text: string) => new Uint8Array(Buffer.from(text, 'hex'));

describe('encodeStringArray', () => {
  it('writes the same bytes as the CLI (indefinite array)', () => {
    // Bytes taken from a CLI-encrypted line.
    expect(hex(encodeStringArray(['a', 'b']))).toBe('9f61616162ff');
    expect(hex(encodeStringArray(['', '']))).toBe('9f6060ff');
  });

  // Expected heads measured with the CLI (Jackson).
  it.each([
    ['x', 22, '76'],
    ['x', 23, '7817'],
    ['x', 254, '78fe'],
    ['x', 255, '7900ff'],
    ['x', 3996, '790f9c'],
    ['ä', 11, '76'],
    ['ä', 12, '7818'],
    ['ä', 127, '78fe'],
    ['ä', 128, '790100'],
    ['€', 22, '7842'],
  ])('writes the CLI length head for %j × %i', (char, count, head) => {
    const encoded = hex(encodeStringArray([char.repeat(count)]));
    expect(encoded.slice(2, 2 + head.length)).toBe(head);
  });

  it('splits long strings into chunks of 3996 chars like the CLI', () => {
    const encoded = encodeStringArray(['x'.repeat(4096) + 'y'.repeat(100)]);
    expect(hex(encoded.slice(0, 5))).toBe('9f7f790f9c');
    expect(hex(encoded.slice(5 + 3996, 5 + 3996 + 2))).toBe('78c8');
  });

  it('does not split a surrogate pair', () => {
    const value = 'x'.repeat(3995) + '😀' + 'x'.repeat(10);
    const encoded = encodeStringArray([value]);
    expect(hex(encoded.slice(2, 5))).toBe('790f9b');
    expect(decodeStringArray(encoded)).toEqual([value]);
  });

  it.each([23, 24, 255, 256, 3997, 65535, 65536, 100000])(
    'round-trips length %i',
    (length) => {
      const value = 'xä'.repeat(length / 2);
      expect(decodeStringArray(encodeStringArray([value]))).toEqual([value]);
    },
  );

  it('round-trips unicode', () => {
    const values = ['äöüß', '日本語', '😀', ''];
    expect(decodeStringArray(encodeStringArray(values))).toEqual(values);
  });
});

describe('decodeStringArray', () => {
  it('reads a definite-length array', () => {
    expect(decodeStringArray(fromHex('8261616162'))).toEqual(['a', 'b']);
  });

  it('reads a chunked text string', () => {
    expect(decodeStringArray(fromHex('9f7f616161626163ffff'))).toEqual(['abc']);
  });

  it.each([
    ['not an array', 'a161'],
    ['not a text string', '9f01ff'],
    ['missing break', '9f6161'],
    ['truncated string', '9f6561ff'],
    ['trailing data', '9f61616162ff00'],
    ['nested chunked string', '9f7f7fffffff'],
    ['unsupported length', '9f7b0000000000000001ff'],
    ['invalid utf-8', '9f61ffff'],
  ])('rejects %s', (_name, input) => {
    expect(() => decodeStringArray(fromHex(input))).toThrow();
  });

  it('throws CborError for structural problems', () => {
    expect(() => decodeStringArray(fromHex('01'))).toThrow(CborError);
  });
});

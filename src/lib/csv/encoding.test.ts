import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  decodeInput,
  encodeUtf16Le,
  encodeUtf16LeWithBom,
  encodeUtf8,
  TextTooLongError,
} from './encoding';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('decodeInput', () => {
  it('reads UTF-8 without BOM', () => {
    expect(decodeInput(encodeUtf8('äö'))).toEqual({
      text: 'äö',
      encoding: 'utf-8',
    });
  });

  it('removes a UTF-8 BOM', () => {
    expect(decodeInput(bytes(0xef, 0xbb, 0xbf, 0x61))).toEqual({
      text: 'a',
      encoding: 'utf-8',
    });
  });

  it('reads UTF-16LE with BOM (Excel Unicode Text)', () => {
    expect(decodeInput(bytes(0xff, 0xfe, 0xe4, 0x00, 0x09, 0x00))).toEqual({
      text: 'ä\t',
      encoding: 'utf-16le',
    });
  });

  it('reads UTF-16BE with BOM', () => {
    expect(decodeInput(bytes(0xfe, 0xff, 0x00, 0xe4))).toEqual({
      text: 'ä',
      encoding: 'utf-16be',
    });
  });

  it('falls back to Windows-1252 for invalid UTF-8 (German Excel CSV)', () => {
    expect(decodeInput(bytes(0xe4, 0x80, 0x3b))).toEqual({
      text: 'ä€;',
      encoding: 'windows-1252',
    });
  });
});

describe('encodeUtf16LeWithBom', () => {
  it('writes BOM and little-endian code units', () => {
    expect(Array.from(encodeUtf16LeWithBom('aä😀'))).toEqual([
      0xff, 0xfe, 0x61, 0x00, 0xe4, 0x00, 0x3d, 0xd8, 0x00, 0xde,
    ]);
  });

  it('round-trips with decodeInput', () => {
    const text = 'id\tName\näöü 😀\n';
    expect(decodeInput(encodeUtf16LeWithBom(text)).text).toBe(text);
  });
});

describe('encodeUtf16Le', () => {
  it('writes little-endian code units without BOM', () => {
    expect(Array.from(encodeUtf16Le('aä'))).toEqual([0x61, 0x00, 0xe4, 0x00]);
  });

  it('gives an empty array for an empty text', () => {
    expect(encodeUtf16Le('')).toHaveLength(0);
  });
});

describe('decodeInput with a text that is too long for the browser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Chrome gives an empty text, without an error, for more than 536,870,888
  // characters. The test simulates this; the real case needs > 512 MB.
  it.each([
    ['UTF-8', [0x61]],
    ['Windows-1252', [0xe4]],
    ['UTF-16LE with BOM', [0xff, 0xfe, 0x61, 0x00]],
  ])('throws instead of an empty text (%s)', (_, values) => {
    vi.spyOn(TextDecoder.prototype, 'decode').mockReturnValue('');
    expect(() => decodeInput(bytes(...values))).toThrow(TextTooLongError);
  });

  it('accepts an empty file and a file with only a BOM', () => {
    expect(decodeInput(bytes()).text).toBe('');
    expect(decodeInput(bytes(0xef, 0xbb, 0xbf)).text).toBe('');
  });
});

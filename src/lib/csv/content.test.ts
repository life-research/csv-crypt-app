import {describe, expect, it} from 'vitest';
import {readFixture} from '../test-support';
import {
  assertTextContent,
  detectNonText,
  NotTextFileError,
  SAMPLE_LENGTH,
} from './content';
import {decodeInput, encodeUtf8} from './encoding';

/** The bytes of a file with the given start, then some text. */
function fileStartingWith(...start: number[]): Uint8Array {
  return Uint8Array.from([...start, ...encodeUtf8('rest of the file')]);
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

/** Detects the kind as the app does: on the bytes and the decoded text. */
function detect(bytes: Uint8Array) {
  return detectNonText(bytes, decodeInput(bytes).text);
}

describe('detectNonText', () => {
  it.each([
    'input/example-comma-utf8.csv',
    'input/excel-2013-csv-german.csv',
    'input/excel-2013-unicode-text.txt',
    'input/edge-cases.csv',
    'cli/example-comma-utf8.crypt.csv',
    'cli/excel-2013-unicode-text.decrypt-excel.csv',
  ])('accepts the text file %s', (path) => {
    expect(detect(readFixture(path))).toBeNull();
  });

  it('accepts an empty file', () => {
    expect(detect(new Uint8Array())).toBeNull();
  });

  it('finds an Excel file (.xlsx) by its ZIP entries', () => {
    const xlsx = Uint8Array.from([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...ascii('....[Content_Types].xml....xl/workbook.xml'),
    ]);
    expect(detect(xlsx)).toBe('excel');
  });

  it.each([
    ['other ZIP file', [0x50, 0x4b, 0x03, 0x04], 'archive'],
    ['empty ZIP file', [0x50, 0x4b, 0x05, 0x06], 'archive'],
    [
      'OLE2 file (.xls)',
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
      'office',
    ],
    ['PDF', ascii('%PDF-1.7'), 'pdf'],
    ['PNG', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image'],
    ['JPEG', [0xff, 0xd8, 0xff, 0xe0], 'image'],
    ['GIF', ascii('GIF89a'), 'image'],
    ['TIFF (little-endian)', [0x49, 0x49, 0x2a, 0x00], 'image'],
    ['TIFF (big-endian)', [0x4d, 0x4d, 0x00, 0x2a], 'image'],
    ['WebP', [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')], 'image'],
    ['GZIP', [0x1f, 0x8b, 0x08], 'archive'],
    ['7z', [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], 'archive'],
    ['RAR', [...ascii('Rar!'), 0x1a, 0x07], 'archive'],
  ])('finds a %s', (_, start, kind) => {
    expect(detect(fileStartingWith(...start))).toBe(kind);
  });

  it('accepts text that starts like a 2-byte signature or a RIFF file', () => {
    expect(detect(encodeUtf8('BM;Name\n1;Anna\n'))).toBeNull();
    expect(detect(encodeUtf8('RIFF;Wert\n1;2\n'))).toBeNull();
  });

  it('finds a null character (binary data, UTF-16 without BOM)', () => {
    expect(detect(Uint8Array.of(0x61, 0x00, 0x2c, 0x00))).toBe('binary');
  });

  it('accepts a few control characters, but not many', () => {
    const fewControls = 'a,b\n'.repeat(100) + '\u000b\u001a';
    expect(detect(encodeUtf8(fewControls))).toBeNull();
    const manyControls = 'a,b\u0001\u0002\n'.repeat(100);
    expect(detect(encodeUtf8(manyControls))).toBe('binary');
  });

  it('reads only the start of the text for the general check', () => {
    const text = 'a,b\n'.repeat(SAMPLE_LENGTH) + '\u0001'.repeat(1000);
    expect(detectNonText(encodeUtf8(text), text)).toBeNull();
  });

  it('accepts tab, form feed and CR as normal characters', () => {
    expect(detect(encodeUtf8('a\tb\f\r\n'.repeat(50)))).toBeNull();
  });
});

describe('assertTextContent', () => {
  it('throws a NotTextFileError with the kind', () => {
    const pdf = fileStartingWith(...ascii('%PDF-'));
    expect(() => assertTextContent(pdf, '')).toThrow(NotTextFileError);
    expect(() => assertTextContent(pdf, '')).toThrow(
      expect.objectContaining({kind: 'pdf'}),
    );
  });

  it('accepts text', () => {
    expect(() => assertTextContent(encodeUtf8('a,b\n'), 'a,b\n')).not.toThrow();
  });
});

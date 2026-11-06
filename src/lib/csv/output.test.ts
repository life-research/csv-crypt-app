import {describe, expect, it} from 'vitest';
import {OutputTooLargeError} from '../limits';
import {encodeUtf16LeWithBom, encodeUtf8} from './encoding';
import {CsvOutput, UTF16LE_WITH_BOM, UTF8} from './output';

describe('CsvOutput', () => {
  it('gives the same bytes as one write of all records (UTF-8)', () => {
    const output = new CsvOutput(',', UTF8);
    output.write([['a', 'b,c']]);
    output.write([['ä'], ['x']]);
    expect(output.finish()).toEqual(encodeUtf8('a,"b,c"\nä\nx\n'));
  });

  it('writes the BOM only once (UTF-16LE)', () => {
    const output = new CsvOutput('\t', UTF16LE_WITH_BOM);
    output.write([['a', 'b']]);
    output.write([['c']]);
    expect(output.finish()).toEqual(encodeUtf16LeWithBom('a\tb\nc\n'));
  });

  it('gives only the BOM for an empty UTF-16LE file', () => {
    expect(new CsvOutput('\t', UTF16LE_WITH_BOM).finish()).toEqual(
      Uint8Array.of(0xff, 0xfe),
    );
  });

  it('gives no bytes for an empty UTF-8 file', () => {
    expect(new CsvOutput(',', UTF8).finish()).toHaveLength(0);
  });

  it('accepts output up to the maximum size', () => {
    const output = new CsvOutput(',', UTF8, 4);
    output.write([['a', 'b']]);
    expect(output.finish()).toEqual(encodeUtf8('a,b\n'));
  });

  it('stops when the output gets larger than the maximum size', () => {
    const output = new CsvOutput(',', UTF8, 6);
    output.write([['a', 'b']]);
    expect(() => output.write([['c', 'd']])).toThrow(
      new OutputTooLargeError(6),
    );
  });
});

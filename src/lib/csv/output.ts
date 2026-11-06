/**
 * Writes CSV output in parts: each batch of records becomes bytes at once,
 * so that the text of the whole file never exists in memory. The parts are
 * joined once, at the end.
 */
import {concatBytes} from '../crypto/cbor';
import {OutputTooLargeError} from '../limits';
import {writeCsv, type Separator} from './csv';
import {encodeUtf16Le, encodeUtf16LeWithBom, encodeUtf8} from './encoding';

export interface OutputEncoding {
  /** Encodes the first part of the file, for example with a BOM. */
  first: (text: string) => Uint8Array<ArrayBuffer>;
  /** Encodes all other parts. */
  rest: (text: string) => Uint8Array<ArrayBuffer>;
}

export const UTF8: OutputEncoding = {first: encodeUtf8, rest: encodeUtf8};

/** With BOM, like the CLI's `--out-optimize-win`. */
export const UTF16LE_WITH_BOM: OutputEncoding = {
  first: encodeUtf16LeWithBom,
  rest: encodeUtf16Le,
};

export class CsvOutput {
  private parts: Uint8Array<ArrayBuffer>[] = [];
  private size = 0;

  /** `maxSize`: `write` throws `OutputTooLargeError` above this size. */
  constructor(
    private readonly separator: Separator,
    private readonly encoding: OutputEncoding,
    private readonly maxSize = Infinity,
  ) {}

  write(records: string[][]): void {
    const text = writeCsv(records, this.separator);
    const encode =
      this.parts.length === 0 ? this.encoding.first : this.encoding.rest;
    const part = encode(text);
    this.size += part.length;
    if (this.size > this.maxSize) {
      throw new OutputTooLargeError(this.maxSize);
    }
    this.parts.push(part);
  }

  /** The whole file. An empty file still gets its BOM, if any. */
  finish(): Uint8Array<ArrayBuffer> {
    if (this.parts.length === 0) {
      this.write([]);
    }
    const bytes = concatBytes(this.parts);
    this.parts = [];
    return bytes;
  }
}

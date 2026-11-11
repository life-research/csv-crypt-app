/**
 * Text encodings of input and output files. Like the CLI, a BOM decides the
 * encoding, else UTF-8. Excel's "Unicode Text" is UTF-16LE with BOM.
 * Unlike the CLI, a file that is not valid UTF-8 is read as Windows-1252,
 * because German Excel saves "CSV (Trennzeichen-getrennt)" in it.
 */

export type InputEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

export interface DecodedText {
  text: string;
  encoding: InputEncoding;
}

const UTF8_BOM = [0xef, 0xbb, 0xbf];
const UTF16LE_BOM = [0xff, 0xfe];
const UTF16BE_BOM = [0xfe, 0xff];

export function decodeInput(bytes: Uint8Array): DecodedText {
  if (startsWith(bytes, UTF8_BOM)) {
    return decode(bytes.subarray(UTF8_BOM.length), 'utf-8');
  }
  if (startsWith(bytes, UTF16LE_BOM)) {
    return decode(bytes.subarray(UTF16LE_BOM.length), 'utf-16le');
  }
  if (startsWith(bytes, UTF16BE_BOM)) {
    return decode(bytes.subarray(UTF16BE_BOM.length), 'utf-16be');
  }
  return decodeUtf8Strict(bytes) ?? decode(bytes, 'windows-1252');
}

/** The browser could not turn the bytes into one text (too long). */
export class TextTooLongError extends Error {
  constructor() {
    super('The browser could not decode the file into one text.');
    this.name = 'TextTooLongError';
  }
}

function decode(body: Uint8Array, encoding: InputEncoding): DecodedText {
  const decoder = new TextDecoder(encoding, {ignoreBOM: true});
  return {text: checkedDecode(decoder, body), encoding};
}

/** Decodes only once: the check for valid UTF-8 also gives the text. */
function decodeUtf8Strict(bytes: Uint8Array): DecodedText | null {
  const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    return null;
  }
  return {text: checkedTextLength(text, bytes), encoding: 'utf-8'};
}

function checkedDecode(decoder: TextDecoder, body: Uint8Array): string {
  return checkedTextLength(decoder.decode(body), body);
}

/**
 * Chrome gives an empty text, without an error, for more than 536,870,888
 * characters. Bytes always give at least one character.
 */
function checkedTextLength(text: string, body: Uint8Array): string {
  if (text.length === 0 && body.length > 0) {
    throw new TextTooLongError();
  }
  return text;
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, i) => bytes[i] === byte);
}

export function encodeUtf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

/** UTF-16LE with BOM, like `--out-optimize-win` (opens correctly in Excel). */
export function encodeUtf16LeWithBom(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(UTF16LE_BOM.length + text.length * 2);
  bytes.set(UTF16LE_BOM);
  bytes.set(encodeUtf16Le(text), UTF16LE_BOM.length);
  return bytes;
}

/** UTF-16LE without BOM, for the parts of a file after the first one. */
export function encodeUtf16Le(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true);
  }
  return bytes;
}

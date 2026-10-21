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
  return isValidUtf8(bytes)
    ? decode(bytes, 'utf-8')
    : decode(bytes, 'windows-1252');
}

function decode(body: Uint8Array, encoding: InputEncoding): DecodedText {
  const text = new TextDecoder(encoding, {ignoreBOM: true}).decode(body);
  return {text, encoding};
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, i) => bytes[i] === byte);
}

export function encodeUtf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

/** UTF-16LE with BOM, like `--out-optimize-win` (opens correctly in Excel). */
export function encodeUtf16LeWithBom(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(2 + text.length * 2);
  const view = new DataView(bytes.buffer);
  bytes.set(UTF16LE_BOM);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  }
  return bytes;
}

/**
 * Finds files that are not text, so that the app does not "encrypt" an Excel
 * file, a PDF or an image as if it were CSV. Checks the content, not the
 * file name: users rename files.
 */
import {startsWith} from './encoding';

/** What the file is instead of text. */
export type NonTextKind =
  'excel' | 'office' | 'pdf' | 'image' | 'archive' | 'binary';

export class NotTextFileError extends Error {
  constructor(readonly kind: NonTextKind) {
    super(`The file is not a text file (${kind}).`);
    this.name = 'NotTextFileError';
  }
}

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const ZIP_EMPTY = [0x50, 0x4b, 0x05, 0x06];

/**
 * Signatures at the start of a file. Only signatures of 3 bytes or more:
 * a CSV file can start with any 2 letters (e.g. `BM`, the BMP signature).
 */
const SIGNATURES: {kind: NonTextKind; bytes: number[]}[] = [
  // OLE2: .xls, .doc, and password-protected .xlsx/.docx.
  {kind: 'office', bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]},
  {kind: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d]}, // %PDF-
  {kind: 'image', bytes: [0x89, 0x50, 0x4e, 0x47]}, // PNG
  {kind: 'image', bytes: [0xff, 0xd8, 0xff]}, // JPEG
  {kind: 'image', bytes: [0x47, 0x49, 0x46, 0x38]}, // GIF8
  {kind: 'image', bytes: [0x49, 0x49, 0x2a, 0x00]}, // TIFF, little-endian
  {kind: 'image', bytes: [0x4d, 0x4d, 0x00, 0x2a]}, // TIFF, big-endian
  {kind: 'archive', bytes: [0x1f, 0x8b, 0x08]}, // GZIP
  {kind: 'archive', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]}, // 7z
  {kind: 'archive', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]}, // RAR
];

/** RIFF container: WebP (an image) at offset 8. */
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

/** Every .xlsx file contains a ZIP entry with this name. */
const EXCEL_ENTRY = [...'xl/workbook'].map((char) => char.charCodeAt(0));

/** Characters that the general check reads. Enough for a decision. */
export const SAMPLE_LENGTH = 65_536;
/** Text files can contain some odd control characters, binary files many. */
const MAX_CONTROL_SHARE = 0.01;

/** Throws `NotTextFileError` if the bytes or the decoded text are not text. */
export function assertTextContent(bytes: Uint8Array, text: string): void {
  const kind = detectNonText(bytes, text);
  if (kind) {
    throw new NotTextFileError(kind);
  }
}

/** The kind of a file that is not text, or `null` for a text file. */
export function detectNonText(
  bytes: Uint8Array,
  text: string,
): NonTextKind | null {
  return detectSignature(bytes) ?? (looksBinary(text) ? 'binary' : null);
}

function detectSignature(bytes: Uint8Array): NonTextKind | null {
  if (startsWith(bytes, ZIP) || startsWith(bytes, ZIP_EMPTY)) {
    return containsBytes(bytes, EXCEL_ENTRY) ? 'excel' : 'archive';
  }
  if (startsWith(bytes, RIFF) && startsWith(bytes.subarray(8), WEBP)) {
    return 'image';
  }
  return (
    SIGNATURES.find(({bytes: sig}) => startsWith(bytes, sig))?.kind ?? null
  );
}

/**
 * A null character never occurs in a CSV file; it shows binary data or
 * UTF-16 without BOM. Other control characters count only in a larger share.
 */
function looksBinary(text: string): boolean {
  const sample = text.slice(0, SAMPLE_LENGTH);
  let controls = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0) {
      return true;
    }
    if (isControl(code)) {
      controls++;
    }
  }
  return controls > sample.length * MAX_CONTROL_SHARE;
}

/** C0 controls and DEL, except tab, LF, form feed and CR. */
function isControl(code: number): boolean {
  const allowed =
    code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d;
  return (code < 0x20 && !allowed) || code === 0x7f;
}

function containsBytes(bytes: Uint8Array, pattern: number[]): boolean {
  const last = bytes.length - pattern.length;
  for (let i = 0; i <= last; i++) {
    if (bytes[i] === pattern[0] && startsWith(bytes.subarray(i), pattern)) {
      return true;
    }
  }
  return false;
}

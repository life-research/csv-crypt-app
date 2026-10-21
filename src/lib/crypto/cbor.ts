/**
 * Minimal CBOR codec for the only payload csv-crypt uses: an array of text
 * strings. The encoder writes exactly the bytes of the CLI (cheshire with
 * Jackson's CBORGenerator), so that a file is byte-identical for the same IV.
 * The decoder also accepts any valid encoding of such an array.
 */

const MAJOR_TEXT = 3;
const MAJOR_ARRAY = 4;
const INDEFINITE = 31;
const BREAK = 0xff;

// Jackson's limits, measured with the CLI. They count UTF-16 code units.
const MAX_SHORT_STRING_CHARS = 22;
const MAX_MEDIUM_STRING_CHARS = 254;
const MAX_CHUNK_CHARS = 3996;

export class CborError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CborError';
  }
}

export function encodeStringArray(values: string[]): Uint8Array<ArrayBuffer> {
  return concatBytes([
    Uint8Array.of((MAJOR_ARRAY << 5) | INDEFINITE),
    ...values.map(encodeText),
    Uint8Array.of(BREAK),
  ]);
}

/** Strings longer than one chunk become an indefinite-length string. */
function encodeText(value: string): Uint8Array {
  if (value.length <= MAX_CHUNK_CHARS) {
    return encodeDefiniteText(value);
  }
  return concatBytes([
    Uint8Array.of((MAJOR_TEXT << 5) | INDEFINITE),
    ...splitIntoChunks(value).map(encodeDefiniteText),
    Uint8Array.of(BREAK),
  ]);
}

/** Splits like Jackson: chunks of MAX_CHUNK_CHARS, never inside a surrogate pair. */
function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + MAX_CHUNK_CHARS, value.length);
    if (end < value.length && isHighSurrogate(value.charCodeAt(end - 1))) {
      end--;
    }
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Jackson selects the size of the length field from the number of chars
 * first, so it does not always use the shortest form (e.g. 23 ASCII chars
 * get a 1-byte length field although 23 fits into the head byte).
 */
function encodeDefiniteText(value: string): Uint8Array {
  const utf8 = new TextEncoder().encode(value);
  return concatBytes([encodeTextHead(value.length, utf8.length), utf8]);
}

function encodeTextHead(chars: number, bytes: number): Uint8Array {
  const type = MAJOR_TEXT << 5;
  if (chars <= MAX_SHORT_STRING_CHARS && bytes < 24) {
    return Uint8Array.of(type | bytes);
  }
  if (chars <= MAX_MEDIUM_STRING_CHARS && bytes < 0x100) {
    return Uint8Array.of(type | 24, bytes);
  }
  if (bytes < 0x10000) {
    return Uint8Array.of(type | 25, bytes >> 8, bytes & 0xff);
  }
  const head = new Uint8Array(5);
  head[0] = type | 26;
  new DataView(head.buffer).setUint32(1, bytes);
  return head;
}

export function decodeStringArray(bytes: Uint8Array): string[] {
  const reader = new Reader(bytes);
  const values = reader.readStringArray();
  if (!reader.atEnd()) {
    throw new CborError('Unexpected data after the CBOR array.');
  }
  return values;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

interface Head {
  major: number;
  info: number;
}

class Reader {
  private offset = 0;
  private readonly view: DataView;
  private readonly decoder = new TextDecoder('utf-8', {fatal: true});

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  atEnd(): boolean {
    return this.offset === this.bytes.length;
  }

  readStringArray(): string[] {
    const {major, info} = this.readHead();
    if (major !== MAJOR_ARRAY) {
      throw new CborError('Expected a CBOR array.');
    }
    const values: string[] = [];
    if (info === INDEFINITE) {
      while (!this.consumeBreak()) {
        values.push(this.readText());
      }
      return values;
    }
    const count = this.readLength(info);
    for (let i = 0; i < count; i++) {
      values.push(this.readText());
    }
    return values;
  }

  private readText(): string {
    const {major, info} = this.readHead();
    if (major !== MAJOR_TEXT) {
      throw new CborError('Expected a CBOR text string.');
    }
    if (info !== INDEFINITE) {
      return this.readTextBody(this.readLength(info));
    }
    const chunks: string[] = [];
    while (!this.consumeBreak()) {
      const chunk = this.readHead();
      if (chunk.major !== MAJOR_TEXT || chunk.info === INDEFINITE) {
        throw new CborError('Invalid chunk in CBOR text string.');
      }
      chunks.push(this.readTextBody(this.readLength(chunk.info)));
    }
    return chunks.join('');
  }

  private readTextBody(length: number): string {
    this.ensureAvailable(length);
    const body = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return this.decoder.decode(body);
  }

  private readHead(): Head {
    const byte = this.readUint8();
    return {major: byte >> 5, info: byte & 0x1f};
  }

  private readLength(info: number): number {
    if (info < 24) {
      return info;
    }
    if (info === 24) {
      return this.readUint8();
    }
    if (info === 25) {
      this.ensureAvailable(2);
      const value = this.view.getUint16(this.offset);
      this.offset += 2;
      return value;
    }
    if (info === 26) {
      this.ensureAvailable(4);
      const value = this.view.getUint32(this.offset);
      this.offset += 4;
      return value;
    }
    throw new CborError('Unsupported CBOR length.');
  }

  private consumeBreak(): boolean {
    this.ensureAvailable(1);
    if (this.bytes[this.offset] === BREAK) {
      this.offset++;
      return true;
    }
    return false;
  }

  private readUint8(): number {
    this.ensureAvailable(1);
    return this.bytes[this.offset++];
  }

  private ensureAvailable(length: number): void {
    if (this.offset + length > this.bytes.length) {
      throw new CborError('Unexpected end of CBOR data.');
    }
  }
}

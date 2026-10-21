import {secureRandomBytes, type RandomBytes} from './random';

export const KEY_LENGTH = 32;

const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;

/** The two halves of a csv-crypt key, imported for Web Crypto. */
export interface CryptoKeys {
  macKey: CryptoKey;
  encKey: CryptoKey;
}

export class InvalidKeyError extends Error {
  constructor() {
    super('The key must have exactly 64 hexadecimal characters.');
    this.name = 'InvalidKeyError';
  }
}

/** Makes a new random key as lowercase hex, like `csv-crypt --gen-key`. */
export function generateHexKey(
  random: RandomBytes = secureRandomBytes,
): string {
  return bytesToHex(random(KEY_LENGTH));
}

export function isValidHexKey(hexKey: string): boolean {
  return HEX_KEY_PATTERN.test(hexKey.trim());
}

/**
 * Imports a hex key. Like buddy's aes128-cbc-hmac-sha256, the first 16 bytes
 * are the HMAC key and the last 16 bytes are the AES key.
 */
export async function importHexKey(hexKey: string): Promise<CryptoKeys> {
  if (!isValidHexKey(hexKey)) {
    throw new InvalidKeyError();
  }
  const raw = hexToBytes(hexKey.trim());
  const [macKey, encKey] = await Promise.all([
    crypto.subtle.importKey(
      'raw',
      raw.slice(0, 16),
      {name: 'HMAC', hash: 'SHA-256'},
      false,
      ['sign'],
    ),
    crypto.subtle.importKey(
      'raw',
      raw.slice(16, 32),
      {name: 'AES-CBC'},
      false,
      ['encrypt', 'decrypt'],
    ),
  ]);
  return {macKey, encKey};
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

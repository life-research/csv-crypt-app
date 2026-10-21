import {base64ToBytes, bytesToBase64} from './base64';
import {concatBytes, decodeStringArray, encodeStringArray} from './cbor';
import type {CryptoKeys} from './key';
import {secureRandomBytes, type RandomBytes} from './random';

/**
 * Line format of csv-crypt (AES128-CBC-HMAC-SHA256 as in buddy-core 1.5):
 * column 1 stays clear, column 2 is Base64(iv || ciphertext || tag), where
 * the plaintext is a CBOR array of the remaining columns and
 * tag = HMAC-SHA256(macKey, iv || ciphertext), truncated to 16 bytes.
 */

const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export type DecryptErrorCode = 'invalid-cipher-text' | 'wrong-key-or-corrupt';

export type DecryptLineResult =
  {ok: true; fields: string[]} | {ok: false; error: DecryptErrorCode};

export async function encryptLine(
  keys: CryptoKeys,
  fields: string[],
  random: RandomBytes = secureRandomBytes,
): Promise<string[]> {
  const [first, ...rest] = fields;
  if (rest.length === 0) {
    return [first];
  }
  const iv = random(IV_LENGTH);
  const plainText = encodeStringArray(rest);
  const cipherText = new Uint8Array(
    await crypto.subtle.encrypt({name: 'AES-CBC', iv}, keys.encKey, plainText),
  );
  const tag = await authTag(keys, iv, cipherText);
  return [first, bytesToBase64(concatBytes([iv, cipherText, tag]))];
}

/** Decrypts a line. Like the CLI, columns after the second are ignored. */
export async function decryptLine(
  keys: CryptoKeys,
  fields: string[],
): Promise<DecryptLineResult> {
  const [first, encrypted] = fields;
  if (encrypted === undefined) {
    return {ok: true, fields: [first]};
  }
  const bytes = base64ToBytes(encrypted);
  if (bytes === null || bytes.length < IV_LENGTH + TAG_LENGTH + 16) {
    return {ok: false, error: 'invalid-cipher-text'};
  }
  const iv = bytes.slice(0, IV_LENGTH);
  const cipherText = bytes.slice(IV_LENGTH, bytes.length - TAG_LENGTH);
  const tag = bytes.slice(bytes.length - TAG_LENGTH);
  if (!constantTimeEqual(tag, await authTag(keys, iv, cipherText))) {
    return {ok: false, error: 'wrong-key-or-corrupt'};
  }
  try {
    const plainText = new Uint8Array(
      await crypto.subtle.decrypt(
        {name: 'AES-CBC', iv},
        keys.encKey,
        cipherText,
      ),
    );
    return {ok: true, fields: [first, ...decodeStringArray(plainText)]};
  } catch {
    return {ok: false, error: 'wrong-key-or-corrupt'};
  }
}

async function authTag(
  keys: CryptoKeys,
  iv: Uint8Array<ArrayBuffer>,
  cipherText: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const mac = await crypto.subtle.sign(
    'HMAC',
    keys.macKey,
    concatBytes([iv, cipherText]),
  );
  return new Uint8Array(mac, 0, TAG_LENGTH);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a[i] ^ b[i];
  }
  return difference === 0;
}

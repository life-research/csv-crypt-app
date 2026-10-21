export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Decodes Base64. Returns `null` if the text is not valid Base64. */
export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/\s/g, ''));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

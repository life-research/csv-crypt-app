/** Returns `length` cryptographically secure random bytes. */
export type RandomBytes = (length: number) => Uint8Array<ArrayBuffer>;

export const secureRandomBytes: RandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));

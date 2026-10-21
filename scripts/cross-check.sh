#!/bin/sh
# Encrypts the fixtures with this app and decrypts them with the original jar.
set -eu
cd "$(dirname "$0")/.."
export CSV_CRYPT_JAR="${CSV_CRYPT_JAR:-.cache/csv-crypt-0.5/csv-crypt-0.5-standalone.jar}"
if [ ! -f "$CSV_CRYPT_JAR" ]; then
  echo "Jar not found: $CSV_CRYPT_JAR (run npm run fixtures or set CSV_CRYPT_JAR)" >&2
  exit 1
fi
exec npx vitest run test/cross-check.test.ts

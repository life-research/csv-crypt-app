// Cross-check against the original CLI: files encrypted by this app must
// decrypt with the jar. Runs only with CSV_CRYPT_JAR (npm run cross-check).
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {encryptFile} from '../src/lib/files';
import {readFixture, TEST_KEY} from '../src/lib/test-support';

const jar = process.env.CSV_CRYPT_JAR;

describe.skipIf(!jar)('CLI decrypts files from this app', () => {
  const dir = mkdtempSync(join(tmpdir(), 'csv-crypt-cross-'));

  it.each([
    'example-comma-utf8.csv',
    'excel-2013-unicode-text.txt',
    'excel-2013-csv-german.csv',
    'edge-cases.csv',
  ])('%s', async (inputName) => {
    const base = inputName.replace(/\.[^.]*$/, '');
    const encrypted = await encryptFile(
      readFixture(`input/${inputName}`),
      TEST_KEY,
      {
        separator: 'auto',
      },
    );
    const encryptedPath = join(dir, `${base}.crypt.csv`);
    const decryptedPath = join(dir, `${base}.decrypt.csv`);
    writeFileSync(encryptedPath, encrypted.output);

    execFileSync('java', [
      '-jar',
      jar!,
      '-d',
      '-k',
      TEST_KEY,
      encryptedPath,
      decryptedPath,
    ]);

    expect(new Uint8Array(readFileSync(decryptedPath))).toEqual(
      readFixture(`cli/${base}.decrypt-utf8.csv`),
    );
  });
});

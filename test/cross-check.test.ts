// Cross-check against the original CLI: files encrypted by this app must
// decrypt with the jar. Runs only with CSV_CRYPT_JAR (npm run cross-check).
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseCsv, writeCsv} from '../src/lib/csv/csv';
import {encryptFile} from '../src/lib/files';
import {readFixture, readFixtureText, TEST_KEY} from '../src/lib/test-support';
import {readWorkbook} from '../src/lib/xlsx/read';
import {writeWorkbook} from '../src/lib/xlsx/write';

const jar = process.env.CSV_CRYPT_JAR;
// Each test starts the JVM. The first, cold start took 7 s on a CI runner.
const cliTimeout = 30_000;

describe.skipIf(!jar)(
  'CLI decrypts files from this app',
  {timeout: cliTimeout},
  () => {
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

    // The rows of an encrypted sheet have the CSV format: a sheet exported
    // as CSV decrypts with the CLI.
    it('a sheet of an encrypted .xlsx file, exported as CSV', async () => {
      const records = parseCsv(readFixtureText('input/edge-cases.csv'), ',');
      const xlsx = await writeWorkbook([{name: 'Daten', rows: records}]);
      const encrypted = await encryptFile(xlsx, TEST_KEY, {separator: 'auto'});
      const [sheet] = await readWorkbook(encrypted.output);
      const encryptedPath = join(dir, 'sheet.crypt.csv');
      const decryptedPath = join(dir, 'sheet.decrypt.csv');
      writeFileSync(encryptedPath, writeCsv(sheet.rows, ','));

      execFileSync('java', [
        '-jar',
        jar!,
        '-d',
        '-k',
        TEST_KEY,
        encryptedPath,
        decryptedPath,
      ]);

      expect(parseCsv(readFileSync(decryptedPath, 'utf8'), ',')).toEqual(
        (await readWorkbook(xlsx))[0].rows,
      );
    });
  },
);

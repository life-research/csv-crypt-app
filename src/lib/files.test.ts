import {describe, expect, it} from 'vitest';
import {decryptFile, encryptFile, type DecryptFileResult} from './files';
import {encodeUtf8} from './csv/encoding';
import {readFixture, TEST_KEY} from './test-support';

const OTHER_KEY = '00'.repeat(32);

function expectOk(result: DecryptFileResult) {
  if (!result.ok) {
    throw new Error(`line ${result.lineNumber}: ${result.error}`);
  }
  return result;
}

describe('decryptFile with CLI output', () => {
  it.each([
    'example-comma-utf8',
    'excel-2013-unicode-text',
    'excel-2013-csv-german',
    'edge-cases',
  ])('gives the same bytes as the CLI for %s', async (name) => {
    const input = readFixture(`cli/${name}.crypt.csv`);
    const utf8 = expectOk(
      await decryptFile(input, TEST_KEY, {
        separator: 'auto',
        outputFormat: 'utf8-comma',
      }),
    );
    expect(utf8.output).toEqual(readFixture(`cli/${name}.decrypt-utf8.csv`));
    const excel = expectOk(
      await decryptFile(input, TEST_KEY, {
        separator: 'auto',
        outputFormat: 'excel',
      }),
    );
    expect(excel.output).toEqual(readFixture(`cli/${name}.decrypt-excel.csv`));
  });

  it('reports the first bad line like the CLI (line 1)', async () => {
    const result = await decryptFile(
      readFixture('input/invalid-first-line.csv'),
      TEST_KEY,
      {
        separator: 'auto',
        outputFormat: 'utf8-comma',
      },
    );
    expect(result).toMatchObject({ok: false, lineNumber: 1});
  });

  it('reports the first bad line like the CLI (line 2)', async () => {
    const result = await decryptFile(
      readFixture('input/invalid-second-line.csv'),
      TEST_KEY,
      {separator: 'auto', outputFormat: 'utf8-comma'},
    );
    expect(result).toMatchObject({ok: false, lineNumber: 2});
  });

  it('reports a wrong key in line 1', async () => {
    const result = await decryptFile(
      readFixture('cli/example-comma-utf8.crypt.csv'),
      OTHER_KEY,
      {separator: 'auto', outputFormat: 'utf8-comma'},
    );
    expect(result).toEqual({
      ok: false,
      lineNumber: 1,
      error: 'wrong-key-or-corrupt',
    });
  });
});

describe('encryptFile', () => {
  it.each([
    ['example-comma-utf8.csv', 'utf-8', ','],
    ['excel-2013-unicode-text.txt', 'utf-16le', '\t'],
    ['excel-2013-csv-german.csv', 'windows-1252', ';'],
    ['edge-cases.csv', 'utf-8', ','],
  ])(
    'encrypts %s so that decryption gives the CLI result',
    async (inputName, encoding, separator) => {
      const base = inputName.replace(/\.[^.]*$/, '');
      const encrypted = await encryptFile(
        readFixture(`input/${inputName}`),
        TEST_KEY,
        {
          separator: 'auto',
        },
      );
      expect(encrypted.input).toMatchObject({encoding, separator});
      const decrypted = expectOk(
        await decryptFile(encrypted.output, TEST_KEY, {
          separator: 'auto',
          outputFormat: 'utf8-comma',
        }),
      );
      expect(decrypted.output).toEqual(
        readFixture(`cli/${base}.decrypt-utf8.csv`),
      );
    },
  );

  it('uses an explicit separator', async () => {
    const input = encodeUtf8('id;a,b\n');
    const result = await encryptFile(input, TEST_KEY, {separator: ','});
    expect(result.input.separator).toBe(',');
    const decrypted = expectOk(
      await decryptFile(result.output, TEST_KEY, {
        separator: ',',
        outputFormat: 'utf8-comma',
      }),
    );
    expect(new TextDecoder().decode(decrypted.output)).toBe('id;a,b\n');
  });

  it('counts the lines', async () => {
    const result = await encryptFile(encodeUtf8('a,1\nb,2\nc\n'), TEST_KEY, {
      separator: 'auto',
    });
    expect(result.input.lineCount).toBe(3);
  });

  it('rejects an invalid key', async () => {
    await expect(
      encryptFile(encodeUtf8('a,b\n'), 'bad', {separator: 'auto'}),
    ).rejects.toThrow();
  });
});

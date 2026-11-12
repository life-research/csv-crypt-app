import {describe, expect, it, vi} from 'vitest';
import {isCancelled} from './batches';
import {FileTooLargeError, MAX_ENCRYPT_INPUT_BYTES} from './limits';
import {decryptFile, encryptFile, type DecryptFileResult} from './files';
import {NotTextFileError} from './csv/content';
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

describe('large files', () => {
  const noPause = () => Promise.resolve();
  const rows = (count: number) =>
    Array.from({length: count}, (_, i) => `id${i},value ${i}\n`).join('');

  it('gives the same output in batches as in one step', async () => {
    const input = encodeUtf8(rows(25));
    const encrypted = await encryptFile(input, TEST_KEY, {
      separator: 'auto',
      batchSize: 4,
      pause: noPause,
    });
    expect(encrypted.input.lineCount).toBe(25);
    const decrypted = expectOk(
      await decryptFile(encrypted.output, TEST_KEY, {
        separator: 'auto',
        outputFormat: 'excel',
        batchSize: 4,
        pause: noPause,
      }),
    );
    const oneStep = expectOk(
      await decryptFile(encrypted.output, TEST_KEY, {
        separator: 'auto',
        outputFormat: 'excel',
        batchSize: 1000,
        pause: noPause,
      }),
    );
    expect(decrypted.output).toEqual(oneStep.output);
    expect(new TextDecoder('utf-16le').decode(decrypted.output)).toBe(
      rows(25).replaceAll(',', '\t'),
    );
  });

  it('reports a bad line in a later batch with its number in the file', async () => {
    const encrypted = await encryptFile(encodeUtf8(rows(10)), TEST_KEY, {
      separator: 'auto',
    });
    const lines = new TextDecoder().decode(encrypted.output).split('\n');
    lines[6] = 'id6,broken';
    const result = await decryptFile(encodeUtf8(lines.join('\n')), TEST_KEY, {
      separator: 'auto',
      outputFormat: 'utf8-comma',
      batchSize: 3,
      pause: noPause,
    });
    expect(result).toEqual({
      ok: false,
      lineNumber: 7,
      error: 'invalid-cipher-text',
    });
  });

  it('stops decrypting after the batch with the first bad line', async () => {
    const onProgress = vi.fn();
    const result = await decryptFile(encodeUtf8(rows(10)), OTHER_KEY, {
      separator: 'auto',
      outputFormat: 'utf8-comma',
      batchSize: 3,
      pause: noPause,
      onProgress,
    });
    expect(result).toMatchObject({ok: false, lineNumber: 1});
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('reports progress and can be cancelled', async () => {
    const controller = new AbortController();
    const onProgress = vi.fn(() => controller.abort());
    const work = encryptFile(encodeUtf8(rows(10)), TEST_KEY, {
      separator: 'auto',
      batchSize: 3,
      pause: noPause,
      signal: controller.signal,
      onProgress,
    });
    await expect(work).rejects.toSatisfy(isCancelled);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});

describe('size limits', () => {
  it('does not encrypt a file above the limit', async () => {
    const input = new Uint8Array(MAX_ENCRYPT_INPUT_BYTES + 1);
    await expect(
      encryptFile(input, TEST_KEY, {separator: 'auto'}),
    ).rejects.toThrow(FileTooLargeError);
  });
});

describe('files that are not text', () => {
  const xlsxRenamedToCsv = Uint8Array.from([
    0x50,
    0x4b,
    0x03,
    0x04,
    ...encodeUtf8('[Content_Types].xml xl/workbook.xml'),
  ]);

  it('does not encrypt an Excel file', async () => {
    await expect(
      encryptFile(xlsxRenamedToCsv, TEST_KEY, {separator: 'auto'}),
    ).rejects.toThrow(expect.objectContaining({kind: 'excel'}));
  });

  it('does not decrypt binary data', async () => {
    await expect(
      decryptFile(Uint8Array.of(1, 2, 0, 3), TEST_KEY, {
        separator: 'auto',
        outputFormat: 'utf8-comma',
      }),
    ).rejects.toThrow(NotTextFileError);
  });
});

import readXlsxFile from 'read-excel-file/universal';
import {describe, expect, it} from 'vitest';
import {importHexKey} from './crypto/key';
import {
  decryptFile,
  encryptFile,
  type DecryptFileResult,
  type DecryptOptions,
} from './files';
import {decryptRecords} from './records';
import {TEST_KEY, withErrorCell} from './test-support';
import {XlsNotSupportedError} from './xlsx/kind';
import {ExcelCellError, readWorkbook} from './xlsx/read';
import {writeWorkbook} from './xlsx/write';

const OTHER_KEY = '00'.repeat(32);
const CSV_OPTIONS = {separator: 'auto'} as const;
const DECRYPT_OPTIONS: DecryptOptions = {
  separator: 'auto',
  outputFormat: 'utf8-comma',
};

function study() {
  return writeWorkbook([
    {
      name: 'Patienten',
      rows: [
        ['ID', 'Name', 'Gewicht', 'Geburtstag', 'Aufnahme', 'Raucher'],
        [
          '00123',
          'Müller, "Hans"',
          72.5,
          dateCell(Date.UTC(1980, 4, 1), 'dd.mm.yyyy'),
          dateCell(Date.UTC(2023, 2, 15, 10, 30), 'dd.mm.yyyy hh:mm'),
          false,
        ],
        ['00124', 'Schmidt\nZeile 2', -1e-7, '', '', true],
      ],
    },
    {
      name: 'Labor',
      rows: [
        ['ID', 'Wert'],
        ['00123', '1234.5'],
      ],
    },
    {name: 'Leer', rows: []},
  ]);
}

function dateCell(time: number, format: string) {
  return {value: new Date(time), type: Date, format};
}

function expectOk(result: DecryptFileResult) {
  if (!result.ok) {
    throw new Error(
      `${result.sheet} line ${result.lineNumber}: ${result.error}`,
    );
  }
  return result;
}

async function roundTrip(input: Uint8Array) {
  const encrypted = await encryptFile(input, TEST_KEY, CSV_OPTIONS);
  const decrypted = expectOk(
    await decryptFile(encrypted.output, TEST_KEY, DECRYPT_OPTIONS),
  );
  return {encrypted, decrypted};
}

describe('encryptFile with an .xlsx file', () => {
  it('keeps the sheets, with column 1 readable and the rest encrypted', async () => {
    const {output} = await encryptFile(await study(), TEST_KEY, CSV_OPTIONS);
    const sheets = await readWorkbook(output);
    expect(sheets.map(({name}) => name)).toEqual([
      'Patienten',
      'Labor',
      'Leer',
    ]);
    const [patients] = sheets;
    expect(patients.rows.map((row) => row[0])).toEqual([
      'ID',
      '00123',
      '00124',
    ]);
    expect(patients.rows.every((row) => row.length === 2)).toBe(true);
    expect(JSON.stringify(sheets)).not.toContain('Müller');
  });

  it('encrypts each row like a line of a CSV file', async () => {
    const {output} = await encryptFile(await study(), TEST_KEY, CSV_OPTIONS);
    const [, labor] = await readWorkbook(output);
    const keys = await importHexKey(TEST_KEY);
    expect(await decryptRecords(keys, labor.rows)).toEqual({
      ok: true,
      records: [
        ['ID', 'Wert'],
        ['00123', '1234.5'],
      ],
    });
  });

  it('describes the sheets of the input', async () => {
    const {input} = await encryptFile(await study(), TEST_KEY, CSV_OPTIONS);
    expect(input).toEqual({
      kind: 'xlsx',
      sheets: [
        {name: 'Patienten', lineCount: 3},
        {name: 'Labor', lineCount: 2},
        {name: 'Leer', lineCount: 0},
      ],
    });
  });

  it('rejects a cell with an Excel error', async () => {
    const xlsx = withErrorCell(await study(), 'xl/worksheets/sheet1.xml', 'C2');
    await expect(encryptFile(xlsx, TEST_KEY, CSV_OPTIONS)).rejects.toThrow(
      ExcelCellError,
    );
  });

  it('rejects a legacy .xls file', async () => {
    const xls = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    await expect(encryptFile(xls, TEST_KEY, CSV_OPTIONS)).rejects.toThrow(
      XlsNotSupportedError,
    );
    await expect(decryptFile(xls, TEST_KEY, DECRYPT_OPTIONS)).rejects.toThrow(
      XlsNotSupportedError,
    );
  });
});

describe('decryptFile with an .xlsx file', () => {
  it('gives back all sheets with the same values', async () => {
    const input = await study();
    const {decrypted} = await roundTrip(input);
    expect(await readWorkbook(decrypted.output)).toEqual(
      await readWorkbook(input),
    );
    expect(decrypted.input).toMatchObject({kind: 'xlsx'});
  });

  it('restores numbers, dates and booleans', async () => {
    const {decrypted} = await roundTrip(await study());
    const [patients] = await readXlsxFile(decrypted.output.buffer);
    expect(patients.data[1]).toEqual([
      '00123',
      'Müller, "Hans"',
      72.5,
      new Date(Date.UTC(1980, 4, 1)),
      new Date(Date.UTC(2023, 2, 15, 10, 30)),
      false,
    ]);
    expect(patients.data[2][2]).toBe(-1e-7);
  });

  it('names the sheet and the line of a wrong key', async () => {
    const {output} = await encryptFile(await study(), TEST_KEY, CSV_OPTIONS);
    expect(await decryptFile(output, OTHER_KEY, DECRYPT_OPTIONS)).toEqual({
      ok: false,
      sheet: 'Patienten',
      lineNumber: 1,
      error: 'wrong-key-or-corrupt',
    });
  });

  it('keeps a row with only column 1 between longer rows', async () => {
    const input = await writeWorkbook([
      {name: 'IDs', rows: [['a', 'x'], ['b'], ['c', 'y']]},
    ]);
    const {decrypted} = await roundTrip(input);
    expect(await readWorkbook(decrypted.output)).toEqual(
      await readWorkbook(input),
    );
  });

  it('keeps a sheet with only column 1', async () => {
    const input = await writeWorkbook([{name: 'IDs', rows: [['a'], ['b']]}]);
    const {decrypted} = await roundTrip(input);
    expect(await readWorkbook(decrypted.output)).toEqual([
      {name: 'IDs', rows: [['a'], ['b']]},
    ]);
  });
});

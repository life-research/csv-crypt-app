import {describe, expect, it} from 'vitest';
import {editZipEntry, withErrorCell} from '../test-support';
import {ExcelCellError, findErrorCell, readWorkbook} from './read';
import {writeWorkbook} from './write';

async function twoSheets() {
  return writeWorkbook([
    {
      name: 'Patienten',
      rows: [
        ['ID', 'Name', 'Wert', 'Datum', 'Aktiv'],
        ['00123', '  Müller ', 1234.5, dateCell(2023, 3, 15), true],
        ['00124', 'Schmidt'],
      ],
    },
    {
      name: 'Labor',
      rows: [
        ['ID', 'Wert'],
        ['00123', 0.1],
      ],
    },
  ]);
}

function dateCell(year: number, month: number, day: number) {
  return {
    value: new Date(Date.UTC(year, month - 1, day)),
    type: Date,
    format: 'dd.mm.yyyy',
  };
}

describe('readWorkbook', () => {
  it('reads all sheets in order with the stored values as text', async () => {
    expect(await readWorkbook(await twoSheets())).toEqual([
      {
        name: 'Patienten',
        rows: [
          ['ID', 'Name', 'Wert', 'Datum', 'Aktiv'],
          ['00123', '  Müller ', '1234.5', '2023-03-15', 'TRUE'],
          ['00124', 'Schmidt', '', '', ''],
        ],
      },
      {
        name: 'Labor',
        rows: [
          ['ID', 'Wert'],
          ['00123', '0.1'],
        ],
      },
    ]);
  });

  it('keeps an empty sheet', async () => {
    const xlsx = await writeWorkbook([
      {name: 'Daten', rows: [['a']]},
      {name: 'Leer', rows: []},
    ]);
    expect(await readWorkbook(xlsx)).toEqual([
      {name: 'Daten', rows: [['a']]},
      {name: 'Leer', rows: []},
    ]);
  });

  it('rejects a cell with an Excel error', async () => {
    const xlsx = withErrorCell(
      await twoSheets(),
      'xl/worksheets/sheet2.xml',
      'B2',
    );
    const error = await readWorkbook(xlsx).catch((caught) => caught);
    expect(error).toBeInstanceOf(ExcelCellError);
    expect(error).toMatchObject({sheet: 'Labor', cell: 'B2'});
  });
});

describe('findErrorCell', () => {
  it('finds nothing in a file without errors', async () => {
    expect(findErrorCell(await twoSheets())).toBeNull();
  });

  it('names the sheet with XML characters in its name', async () => {
    const xlsx = await writeWorkbook([{name: 'A & B', rows: [['1', 'x']]}]);
    expect(
      findErrorCell(withErrorCell(xlsx, 'xl/worksheets/sheet1.xml', 'B1')),
    ).toEqual({sheet: 'A & B', cell: 'B1'});
  });

  it('follows an absolute target path of a sheet', async () => {
    const xlsx = withErrorCell(
      await twoSheets(),
      'xl/worksheets/sheet1.xml',
      'A2',
    );
    const absolute = editZipEntry(xlsx, 'xl/_rels/workbook.xml.rels', (xml) =>
      xml.replaceAll('Target="worksheets/', 'Target="/xl/worksheets/'),
    );
    expect(findErrorCell(absolute)).toEqual({sheet: 'Patienten', cell: 'A2'});
  });

  describe('in a broken file, which read-excel-file then rejects', () => {
    async function withError() {
      return withErrorCell(await twoSheets(), 'xl/worksheets/sheet1.xml', 'A2');
    }

    it('finds nothing without workbook.xml', async () => {
      const xlsx = editZipEntry(await withError(), 'xl/workbook.xml', () => '');
      expect(findErrorCell(xlsx)).toBeNull();
    });

    it('skips a sheet whose file is missing', async () => {
      const xlsx = editZipEntry(
        await withError(),
        'xl/_rels/workbook.xml.rels',
        (xml) => xml.replace('worksheets/sheet1.xml', 'worksheets/missing.xml'),
      );
      expect(findErrorCell(xlsx)).toBeNull();
    });

    it('skips a sheet without relationship id', async () => {
      const xlsx = editZipEntry(await withError(), 'xl/workbook.xml', (xml) =>
        xml.replace('r:id="rId1"', ''),
      );
      expect(findErrorCell(xlsx)).toBeNull();
    });

    it('skips a relationship without target', async () => {
      const xlsx = editZipEntry(
        await withError(),
        'xl/_rels/workbook.xml.rels',
        (xml) => xml.replace('Target="worksheets/sheet1.xml"', ''),
      );
      expect(findErrorCell(xlsx)).toBeNull();
    });

    it('reports a sheet without name with an empty name', async () => {
      const xlsx = editZipEntry(await withError(), 'xl/workbook.xml', (xml) =>
        xml.replace('name="Patienten"', ''),
      );
      expect(findErrorCell(xlsx)).toEqual({sheet: '', cell: 'A2'});
    });
  });
});

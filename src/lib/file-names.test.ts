import {describe, expect, it} from 'vitest';
import {ACCEPT, checkFileName, isExcelFileName} from './file-names';

describe('checkFileName', () => {
  it.each(['Liste.csv', 'Liste.txt', 'Studie.xlsx', 'STUDIE.XLSX', 'a.b.csv'])(
    'accepts %s',
    (name) => {
      expect(checkFileName(name)).toBe('supported');
    },
  );

  it.each(['Studie.xls', 'STUDIE.XLS'])('reports the legacy %s', (name) => {
    expect(checkFileName(name)).toBe('xls');
  });

  it.each([
    'Bericht.pdf',
    'Daten.json',
    'Studie.xlsm',
    'Liste.csv.zip',
    'csv',
    'Liste',
    'Liste.',
  ])('rejects %s', (name) => {
    expect(checkFileName(name)).toBe('unsupported');
  });
});

describe('isExcelFileName', () => {
  it.each(['Studie.xlsx', 'STUDIE.XLSX', 'a.b.xlsx'])('accepts %s', (name) => {
    expect(isExcelFileName(name)).toBe(true);
  });

  it.each(['Studie.csv', 'Studie.xls', 'xlsx.txt'])('rejects %s', (name) => {
    expect(isExcelFileName(name)).toBe(false);
  });
});

describe('ACCEPT', () => {
  it('lists the supported extensions for the file input', () => {
    expect(ACCEPT).toBe('.csv,.txt,.xlsx');
  });
});

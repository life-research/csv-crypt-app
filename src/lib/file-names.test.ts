import {describe, expect, it} from 'vitest';
import {ACCEPT, checkFileName} from './file-names';

describe('checkFileName', () => {
  it.each([
    ['daten.csv', 'supported'],
    ['Daten.CSV', 'supported'],
    ['export.txt', 'supported'],
    ['daten_crypt.csv', 'supported'],
    ['studie.xlsx', 'excel'],
    ['studie.XLS', 'excel'],
    ['studie.xlsm', 'excel'],
    ['studie.xlsb', 'excel'],
    ['bericht.pdf', 'unsupported'],
    ['daten.csv.zip', 'unsupported'],
    ['daten.tsv', 'unsupported'],
    ['ohne-endung', 'unsupported'],
    ['.csv', 'supported'],
  ])('%s → %s', (name, expected) => {
    expect(checkFileName(name)).toBe(expected);
  });
});

describe('ACCEPT', () => {
  it('lists the supported extensions for the file dialog', () => {
    expect(ACCEPT).toBe('.csv,.txt');
  });
});

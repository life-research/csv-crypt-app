import {describe, expect, it} from 'vitest';
import {
  cellToText,
  DATE_FORMAT,
  DATE_TIME_FORMAT,
  textToCell,
  type ReadCell,
} from './cells';

describe('cellToText', () => {
  it.each<[string, ReadCell, string]>([
    ['keeps text, also with spaces', '  Müller ', '  Müller '],
    ['keeps text with leading zeros', '00123', '00123'],
    ['keeps the stored number text', '1234.5', '1234.5'],
    ['keeps an exponent', '1E-7', '1E-7'],
    ['writes TRUE', true, 'TRUE'],
    ['writes FALSE', false, 'FALSE'],
    ['writes an empty cell as empty text', null, ''],
    ['writes a missing cell as empty text', undefined, ''],
    [
      'writes a date without time',
      new Date(Date.UTC(2023, 2, 15)),
      '2023-03-15',
    ],
    [
      'writes a date with time',
      new Date(Date.UTC(2023, 2, 15, 10, 30, 5)),
      '2023-03-15T10:30:05',
    ],
    [
      'rounds the float error of Excel times',
      new Date(Date.UTC(2023, 2, 15, 10, 30, 4, 999)),
      '2023-03-15T10:30:05',
    ],
  ])('%s', (_, value, expected) => {
    expect(cellToText(value)).toBe(expected);
  });
});

describe('textToCell', () => {
  it.each([
    ['1234.5', 1234.5],
    ['-3', -3],
    ['0', 0],
    ['0.1', 0.1],
    ['1E-7', 1e-7],
    ['1e-7', 1e-7],
    ['1.5E+20', 1.5e20],
    ['123456789012345', 123456789012345],
  ])('restores the number %s', (text, expected) => {
    expect(textToCell(text)).toBe(expected);
  });

  it.each([
    ['leading zeros', '00123'],
    ['a plus sign', '+5'],
    ['a decimal comma', '1234,5'],
    ['more than 15 significant digits', '1234567890123456'],
    ['spaces', ' 12 '],
    ['a missing integer part', '.5'],
    ['an empty cell', ''],
    ['plain text', 'Müller'],
    ['a lower-case boolean', 'true'],
    ['a date that does not exist', '2023-02-30'],
    ['a German date', '15.03.2023'],
    ['a date with midnight time', '2023-03-15T00:00:00'],
  ])('keeps text with %s', (_, text) => {
    expect(textToCell(text)).toBe(text);
  });

  it('restores booleans', () => {
    expect(textToCell('TRUE')).toBe(true);
    expect(textToCell('FALSE')).toBe(false);
  });

  it('restores a date', () => {
    expect(textToCell('2023-03-15')).toEqual({
      value: new Date(Date.UTC(2023, 2, 15)),
      type: Date,
      format: DATE_FORMAT,
    });
  });

  it('restores a date with time', () => {
    expect(textToCell('2023-03-15T10:30:05')).toEqual({
      value: new Date(Date.UTC(2023, 2, 15, 10, 30, 5)),
      type: Date,
      format: DATE_TIME_FORMAT,
    });
  });
});

describe('cellToText and textToCell', () => {
  it.each<ReadCell>([
    true,
    false,
    new Date(Date.UTC(2024, 1, 29)),
    new Date(Date.UTC(2024, 1, 29, 23, 59, 59)),
  ])('give back %s', (value) => {
    const cell = textToCell(cellToText(value));
    expect(typeof cell === 'object' ? cell.value : cell).toEqual(value);
  });
});

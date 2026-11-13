import {describe, expect, it} from 'vitest';
import {
  CsvParseError,
  detectSeparator,
  parseCsv,
  readCsv,
  writeCsv,
} from './csv';

describe('parseCsv', () => {
  it('reads simple records', () => {
    expect(parseCsv('a,b\n1,2\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('accepts CRLF and a missing final line end', () => {
    expect(parseCsv('a,b\r\n1,2', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('reads quoted fields with separators, quotes and line ends', () => {
    expect(parseCsv('"a,b","say ""hi""","x\r\ny"\n', ',')).toEqual([
      ['a,b', 'say "hi"', 'x\r\ny'],
    ]);
  });

  it('reads empty fields and empty lines', () => {
    expect(parseCsv('a,,\n\nb\n', ',')).toEqual([['a', '', ''], [''], ['b']]);
  });

  it('uses the given separator only', () => {
    expect(parseCsv('a;b,c\tx\n', ';')).toEqual([['a', 'b,c\tx']]);
    expect(parseCsv('a;b,c\tx\n', '\t')).toEqual([['a;b,c', 'x']]);
  });

  it('returns no records for an empty text', () => {
    expect(parseCsv('', ',')).toEqual([]);
  });

  it('reports an unclosed quote with its start line', () => {
    expect(() => parseCsv('a\nb\n"c\nd', ',')).toThrow(CsvParseError);
    try {
      parseCsv('a\nb\n"c\nd', ',');
    } catch (error) {
      expect((error as CsvParseError).lineNumber).toBe(3);
    }
  });
});

describe('readCsv', () => {
  it('gives the offset after each record, also after CRLF', () => {
    expect([...readCsv('a,b\r\n"x\ny"\nlast', ',')]).toEqual([
      {fields: ['a', 'b'], line: 1, end: 5},
      {fields: ['x\ny'], line: 2, end: 11},
      {fields: ['last'], line: 4, end: 15},
    ]);
  });

  it('reads the records lazily, up to an unclosed quote', () => {
    const records = readCsv('a\nb\n"c\nd', ',');
    expect(records.next().value).toEqual({fields: ['a'], line: 1, end: 2});
    expect(records.next().value).toEqual({fields: ['b'], line: 2, end: 4});
    expect(() => records.next()).toThrow(CsvParseError);
  });

  it('counts the line ends inside quoted fields for the start line', () => {
    const text = 'id,note\n1,"two\nlines"\n2,"three\r\nline\nend"\n3,x\n';
    expect([...readCsv(text, ',')].map(({line}) => line)).toEqual([1, 2, 4, 7]);
  });

  it('counts empty lines and CRLF for the start line', () => {
    expect([...readCsv('a\r\n\r\nb\r\n', ',')].map(({line}) => line)).toEqual([
      1, 2, 3,
    ]);
  });

  it('joins quoted and plain parts of one field', () => {
    expect(parseCsv('ab"c,d"ef,g\n', ',')).toEqual([['abc,def', 'g']]);
  });

  it('keeps a single CR inside a field', () => {
    expect(parseCsv('a\rb,c\n', ',')).toEqual([['a\rb', 'c']]);
  });
});

describe('writeCsv', () => {
  it('quotes only where necessary, like clojure.data.csv', () => {
    const records = [
      ['plain', 'a,b', 'say "hi"', 'x\ny', 'x\ry', 'semi;colon'],
    ];
    expect(writeCsv(records, ',')).toBe(
      'plain,"a,b","say ""hi""","x\ny","x\ry",semi;colon\n',
    );
  });

  it('quotes the tab separator', () => {
    expect(writeCsv([['a\tb', 'c,d']], '\t')).toBe('"a\tb"\tc,d\n');
  });

  it('round-trips with parseCsv', () => {
    const records = [['id', 'a "b"', 'c,d', 'e\r\nf', ''], ['x']];
    expect(parseCsv(writeCsv(records, ','), ',')).toEqual(records);
  });
});

describe('detectSeparator', () => {
  it.each([
    ['a,b,c\n', ','],
    ['a;b;c\n', ';'],
    ['a\tb\tc\n', '\t'],
    ['"a;b;c",d\n', ','],
    ['a,b\nc;d;e;f\n', ','],
    ['single\n', ','],
    ['', ','],
  ])('%j → %j', (text, expected) => {
    expect(detectSeparator(text)).toBe(expected);
  });
});

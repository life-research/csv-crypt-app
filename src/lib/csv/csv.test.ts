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
  it('reads the records lazily, up to an unclosed quote', () => {
    const records = readCsv('a\nb\n"c\nd', ',');
    expect(records.next().value).toEqual(['a']);
    expect(records.next().value).toEqual(['b']);
    expect(() => records.next()).toThrow(CsvParseError);
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

import {describe, expect, it} from 'vitest';
import {CsvParseError} from './csv/csv';
import {de} from './i18n/de';
import {format, type MessageKey, type Params} from './i18n/i18n';
import {
  decryptErrorMessage,
  inputSummary,
  rejectedFileMessage,
  unexpectedErrorMessage,
} from './messages';
import {XlsNotSupportedError} from './xlsx/kind';
import {ExcelCellError} from './xlsx/read';

const t = (key: MessageKey, params?: Params) => format(de[key], params);

describe('messages', () => {
  it('describes a decrypt error with its line', () => {
    expect(decryptErrorMessage(t, 4, 'wrong-key-or-corrupt')).toBe(
      'Fehler in Zeile 4: Der Schlüssel ist falsch, oder die Datei wurde verändert.',
    );
  });

  it('describes a decrypt error in a sheet of an Excel file', () => {
    expect(decryptErrorMessage(t, 2, 'invalid-cipher-text', 'Labor')).toBe(
      'Fehler im Blatt „Labor“, Zeile 2: Die zweite Spalte enthält keine gültigen verschlüsselten Daten.',
    );
  });

  it('describes a legacy .xls file', () => {
    expect(unexpectedErrorMessage(t, new XlsNotSupportedError())).toContain(
      '.xlsx',
    );
  });

  it('describes a cell with an Excel error', () => {
    expect(
      unexpectedErrorMessage(t, new ExcelCellError('Labor', 'C7')),
    ).toContain('Die Zelle C7 im Blatt „Labor“');
  });

  it('takes CSV, text and Excel files', () => {
    expect(rejectedFileMessage(t, 'Liste.csv')).toBeNull();
    expect(rejectedFileMessage(t, 'Liste.txt')).toBeNull();
    expect(rejectedFileMessage(t, 'Studie.xlsx')).toBeNull();
  });

  it('rejects other files with the allowed extensions', () => {
    expect(rejectedFileMessage(t, 'Bericht.pdf')).toBe(
      'Die App kann die Datei „Bericht.pdf“ nicht verarbeiten. Erlaubt sind CSV- und Excel-Dateien (.csv, .txt, .xlsx).',
    );
  });

  it('rejects a legacy .xls file with a hint to save it as .xlsx', () => {
    expect(rejectedFileMessage(t, 'Studie.xls')).toContain('als .xlsx');
  });

  it('describes an unclosed quote', () => {
    expect(unexpectedErrorMessage(t, new CsvParseError(7))).toContain(
      'Zeile 7',
    );
  });

  it('describes other errors', () => {
    expect(unexpectedErrorMessage(t, new Error('boom'))).toBe(
      'Unerwarteter Fehler: boom',
    );
    expect(unexpectedErrorMessage(t, 'text')).toBe('Unerwarteter Fehler: text');
  });

  it('summarises the input', () => {
    expect(
      inputSummary(t, {
        kind: 'csv',
        lineCount: 3,
        encoding: 'windows-1252',
        separator: ';',
      }),
    ).toBe('3 Zeilen · Kodierung Windows-1252 · Trennzeichen Semikolon (;)');
  });

  it('summarises an Excel file', () => {
    expect(
      inputSummary(t, {
        kind: 'xlsx',
        sheets: [
          {name: 'Patienten', lineCount: 3},
          {name: 'Leer', lineCount: 0},
        ],
      }),
    ).toBe('2 Blätter · 3 Zeilen');
  });
});

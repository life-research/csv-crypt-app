import {describe, expect, it} from 'vitest';
import {NotTextFileError} from './csv/content';
import {CsvParseError} from './csv/csv';
import {TextTooLongError} from './csv/encoding';
import {FileTooLargeError, MIB, OutputTooLargeError} from './limits';
import {de} from './i18n/de';
import {format, type MessageKey, type Params} from './i18n/i18n';
import {
  decryptErrorMessage,
  inputSummary,
  rejectedFileMessage,
  unexpectedErrorMessage,
} from './messages';

const t = (key: MessageKey, params?: Params) => format(de[key], params);

describe('messages', () => {
  it('describes a decrypt error with its line', () => {
    expect(decryptErrorMessage(t, 4, 'wrong-key-or-corrupt')).toBe(
      'Fehler in Zeile 4: Der Schlüssel ist falsch, oder die Datei wurde verändert.',
    );
  });

  it('describes an unclosed quote', () => {
    expect(unexpectedErrorMessage(t, new CsvParseError(7))).toContain(
      'Zeile 7',
    );
  });

  it('describes a file that is too large, in MB', () => {
    expect(
      unexpectedErrorMessage(t, new FileTooLargeError(210.54 * MIB, 200 * MIB)),
    ).toBe(
      'Die Datei ist zu groß (210.5 MB). Die App verarbeitet Dateien bis 200 MB. Bitte teilen Sie die Datei in kleinere Dateien auf.',
    );
  });

  it('describes an encrypted file that would be too large', () => {
    expect(
      unexpectedErrorMessage(t, new OutputTooLargeError(500 * MIB)),
    ).toContain('größer als 500 MB');
  });

  it('describes a text that the browser cannot read', () => {
    expect(unexpectedErrorMessage(t, new TextTooLongError())).toBe(
      de['error.textTooLong'],
    );
  });

  it('describes a file that is not text', () => {
    expect(unexpectedErrorMessage(t, new NotTextFileError('excel'))).toBe(
      de['error.notText.excel'],
    );
    expect(unexpectedErrorMessage(t, new NotTextFileError('binary'))).toBe(
      de['error.notText.binary'],
    );
  });

  it('accepts supported file names', () => {
    expect(rejectedFileMessage(t, 'daten.csv')).toBeNull();
  });

  it('names the allowed extensions for an unsupported file', () => {
    expect(rejectedFileMessage(t, 'bericht.pdf')).toBe(
      'Die App kann die Datei „bericht.pdf“ nicht verarbeiten. Erlaubt sind CSV- und Textdateien (.csv, .txt).',
    );
  });

  it('tells how to save an Excel file as CSV', () => {
    expect(rejectedFileMessage(t, 'studie.xlsx')).toContain(
      '„studie.xlsx“ in Excel',
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
      inputSummary(t, {lineCount: 3, encoding: 'windows-1252', separator: ';'}),
    ).toBe('3 Zeilen · Kodierung Windows-1252 · Trennzeichen Semikolon (;)');
  });
});

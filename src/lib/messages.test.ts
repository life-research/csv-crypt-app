import {describe, expect, it} from 'vitest';
import {CsvParseError} from './csv/csv';
import {de} from './i18n/de';
import {format, type MessageKey, type Params} from './i18n/i18n';
import {
  decryptErrorMessage,
  inputSummary,
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

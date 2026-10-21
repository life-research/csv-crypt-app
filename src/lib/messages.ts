import {CsvParseError, type Separator} from './csv/csv';
import type {InputEncoding} from './csv/encoding';
import type {DecryptErrorCode} from './crypto/line';
import type {MessageKey, Params} from './i18n/i18n';

export type Translate = (key: MessageKey, params?: Params) => string;

export function decryptErrorMessage(
  t: Translate,
  lineNumber: number,
  error: DecryptErrorCode,
): string {
  return t('error.line', {line: lineNumber, message: t(`error.${error}`)});
}

export function unexpectedErrorMessage(t: Translate, error: unknown): string {
  if (error instanceof CsvParseError) {
    return t('error.unclosedQuote', {line: error.lineNumber});
  }
  const message = error instanceof Error ? error.message : String(error);
  return t('error.unexpected', {message});
}

const ENCODING_NAMES: Record<InputEncoding, string> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  'windows-1252': 'Windows-1252',
};

const SEPARATOR_KEYS: Record<Separator, MessageKey> = {
  ',': 'separator.comma',
  ';': 'separator.semicolon',
  '\t': 'separator.tab',
};

export function inputSummary(
  t: Translate,
  info: {lineCount: number; encoding: InputEncoding; separator: Separator},
): string {
  return t('info.summary', {
    lines: info.lineCount,
    encoding: ENCODING_NAMES[info.encoding],
    separator: t(SEPARATOR_KEYS[info.separator]),
  });
}

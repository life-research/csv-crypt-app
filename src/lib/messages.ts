import {CsvParseError, type Separator} from './csv/csv';
import type {InputEncoding} from './csv/encoding';
import type {DecryptErrorCode} from './crypto/line';
import type {InputInfo} from './files';
import type {MessageKey, Params} from './i18n/i18n';
import {XlsNotSupportedError} from './xlsx/kind';
import {ExcelCellError} from './xlsx/read';

export type Translate = (key: MessageKey, params?: Params) => string;

/** `sheet` is set for Excel files, which can have several sheets. */
export function decryptErrorMessage(
  t: Translate,
  lineNumber: number,
  error: DecryptErrorCode,
  sheet?: string,
): string {
  const message = t(`error.${error}`);
  return sheet === undefined
    ? t('error.line', {line: lineNumber, message})
    : t('error.sheetLine', {sheet, line: lineNumber, message});
}

export function unexpectedErrorMessage(t: Translate, error: unknown): string {
  if (error instanceof CsvParseError) {
    return t('error.unclosedQuote', {line: error.lineNumber});
  }
  if (error instanceof XlsNotSupportedError) {
    return t('error.xlsFile');
  }
  if (error instanceof ExcelCellError) {
    return t('error.excelCell', {sheet: error.sheet, cell: error.cell});
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

export function inputSummary(t: Translate, info: InputInfo): string {
  if (info.kind === 'xlsx') {
    const lines = info.sheets.reduce((sum, {lineCount}) => sum + lineCount, 0);
    return t('info.workbook', {sheets: info.sheets.length, lines});
  }
  return t('info.summary', {
    lines: info.lineCount,
    encoding: ENCODING_NAMES[info.encoding],
    separator: t(SEPARATOR_KEYS[info.separator]),
  });
}

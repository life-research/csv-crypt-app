import {NotTextFileError} from './csv/content';
import {CsvParseError, type Separator} from './csv/csv';
import {TextTooLongError, type InputEncoding} from './csv/encoding';
import type {DecryptErrorCode} from './crypto/line';
import {checkFileName, SUPPORTED_EXTENSIONS} from './file-names';
import type {MessageKey, Params} from './i18n/i18n';
import {FileTooLargeError, MIB, OutputTooLargeError} from './limits';

export type Translate = (key: MessageKey, params?: Params) => string;

export function decryptErrorMessage(
  t: Translate,
  lineNumber: number,
  error: DecryptErrorCode,
): string {
  return t('error.line', {line: lineNumber, message: t(`error.${error}`)});
}

/** Why the app does not take a selected file, or `null` if it does. */
export function rejectedFileMessage(t: Translate, name: string): string | null {
  switch (checkFileName(name)) {
    case 'supported':
      return null;
    case 'excel':
      return t('file.excel', {name});
    case 'unsupported': {
      const extensions = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`);
      return t('file.unsupported', {name, extensions: extensions.join(', ')});
    }
  }
}

export function unexpectedErrorMessage(t: Translate, error: unknown): string {
  if (error instanceof CsvParseError) {
    return t('error.unclosedQuote', {line: error.lineNumber});
  }
  if (error instanceof FileTooLargeError) {
    return t('error.fileTooLarge', {
      size: megabytes(error.size),
      max: megabytes(error.maxSize),
    });
  }
  if (error instanceof OutputTooLargeError) {
    return t('error.outputTooLarge', {max: megabytes(error.maxSize)});
  }
  if (error instanceof TextTooLongError) {
    return t('error.textTooLong');
  }
  if (error instanceof NotTextFileError) {
    return t(`error.notText.${error.kind}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return t('error.unexpected', {message});
}

/** Bytes as MB with one decimal, e.g. `210.5`; the limits are whole MB. */
function megabytes(bytes: number): string {
  const value = bytes / MIB;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

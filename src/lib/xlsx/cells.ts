/**
 * Converts Excel cell values to text and back. Encryption works on text, like
 * the CLI, so each cell becomes the value stored in the file (not the text
 * that Excel shows). Decryption restores numbers, dates and booleans only for
 * text in exactly the form that `cellToText` writes.
 */

/** A cell as read by read-excel-file with `parseNumber: (text) => text`. */
export type ReadCell = string | number | boolean | Date | null | undefined;

export interface DateCell {
  value: Date;
  type: DateConstructor;
  format: string;
}

/** A cell for write-excel-file. */
export type WriteCell = string | number | boolean | DateCell;

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
/** Excel keeps 15 significant digits; more would change the value. */
const MAX_SIGNIFICANT_DIGITS = 15;

export const DATE_FORMAT = 'yyyy-mm-dd';
export const DATE_TIME_FORMAT = 'yyyy-mm-dd hh:mm:ss';

/** `true` → `TRUE`, date → `2023-03-15` or `2023-03-15T10:30:05`. */
export function cellToText(value: ReadCell): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) {
    return dateToText(value);
  }
  return String(value);
}

/** The reverse of `cellToText`; all other text stays text. */
export function textToCell(text: string): WriteCell {
  if (text === 'TRUE' || text === 'FALSE') {
    return text === 'TRUE';
  }
  if (NUMBER.test(text) && significantDigits(text) <= MAX_SIGNIFICANT_DIGITS) {
    return Number(text);
  }
  return textToDateCell(text) ?? text;
}

function dateToText(date: Date): string {
  // Excel stores dates as fractions of a day; round away the float error.
  const rounded = new Date(Math.round(date.getTime() / 1000) * 1000);
  const [day, time] = rounded.toISOString().slice(0, 19).split('T');
  return time === '00:00:00' ? day : `${day}T${time}`;
}

function textToDateCell(text: string): DateCell | null {
  const match = DATE_TIME.exec(text) ?? DATE.exec(text);
  if (!match) {
    return null;
  }
  const [year, month, day, hours = 0, minutes = 0, seconds = 0] = match
    .slice(1)
    .map(Number);
  const value = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds),
  );
  // Rejects dates that do not exist, such as 2023-02-30.
  if (dateToText(value) !== text) {
    return null;
  }
  const format = match.length > 4 ? DATE_TIME_FORMAT : DATE_FORMAT;
  return {value, type: Date, format};
}

function significantDigits(number: string): number {
  const mantissa = number.replace(/^-/, '').replace(/[eE].*$/, '');
  return mantissa.replace('.', '').replace(/^0+/, '').length;
}

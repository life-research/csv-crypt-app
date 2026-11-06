/**
 * CSV reader and writer with the same rules as clojure.data.csv, which the
 * CLI uses: `"` quotes, `""` escapes a quote, records end with LF or CRLF,
 * and a final line end does not start a new record.
 */

export type Separator = ',' | ';' | '\t';

const QUOTE = '"';

export class CsvParseError extends Error {
  constructor(readonly lineNumber: number) {
    super(`Unclosed quote in the record that starts on line ${lineNumber}.`);
    this.name = 'CsvParseError';
  }
}

export function parseCsv(text: string, separator: Separator): string[][] {
  return Array.from(readCsv(text, separator));
}

/**
 * Reads the records one by one, so that a caller can process a large file
 * without all records in memory. Throws `CsvParseError` when it reaches an
 * unclosed quote. Plain characters are added as slices, not one by one.
 */
export function* readCsv(
  text: string,
  separator: Separator,
): Generator<string[]> {
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  // Start of the plain characters that are not yet added to `field`.
  let runStart = 0;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === QUOTE) {
        field += text.slice(runStart, i);
        const escaped = text[i + 1] === QUOTE;
        field += escaped ? QUOTE : '';
        inQuotes = escaped;
        i += escaped ? 2 : 1;
        runStart = i;
      } else {
        line += char === '\n' ? 1 : 0;
        i++;
      }
      continue;
    }
    if (char === QUOTE) {
      field += text.slice(runStart, i);
      inQuotes = true;
      runStart = ++i;
    } else if (char === separator) {
      record.push(field + text.slice(runStart, i));
      field = '';
      runStart = ++i;
    } else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
      record.push(field + text.slice(runStart, i));
      field = '';
      i += char === '\r' ? 2 : 1;
      line++;
      yield record;
      record = [];
      recordStartLine = line;
      runStart = i;
    } else {
      i++;
    }
  }

  if (inQuotes) {
    throw new CsvParseError(recordStartLine);
  }
  field += text.slice(runStart);
  if (field !== '' || record.length > 0) {
    record.push(field);
    yield record;
  }
}

export function writeCsv(records: string[][], separator: Separator): string {
  return records
    .map(
      (record) =>
        record.map((f) => quoteField(f, separator)).join(separator) + '\n',
    )
    .join('');
}

function quoteField(field: string, separator: Separator): string {
  const needsQuotes =
    field.includes(separator) ||
    field.includes(QUOTE) ||
    field.includes('\r') ||
    field.includes('\n');
  return needsQuotes
    ? QUOTE + field.replaceAll(QUOTE, QUOTE + QUOTE) + QUOTE
    : field;
}

/**
 * Guesses the separator from the first line: the candidate that occurs most
 * often outside of quotes wins. Comma is the default, like in the CLI.
 */
export function detectSeparator(text: string): Separator {
  const counts: Record<Separator, number> = {',': 0, ';': 0, '\t': 0};
  let inQuotes = false;
  for (const char of text) {
    if (char === QUOTE) {
      inQuotes = !inQuotes;
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      break;
    } else if (!inQuotes && char in counts) {
      counts[char as Separator]++;
    }
  }
  const best = (Object.keys(counts) as Separator[]).reduce((a, b) =>
    counts[b] > counts[a] ? b : a,
  );
  return counts[best] > 0 ? best : ',';
}

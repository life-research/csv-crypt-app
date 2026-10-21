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
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let i = 0;

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
    recordStartLine = line;
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === QUOTE && text[i + 1] === QUOTE) {
        field += QUOTE;
        i += 2;
        continue;
      }
      if (char === QUOTE) {
        inQuotes = false;
      } else {
        if (char === '\n') {
          line++;
        }
        field += char;
      }
      i++;
      continue;
    }
    if (char === QUOTE) {
      inQuotes = true;
    } else if (char === separator) {
      endField();
    } else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
      i += char === '\r' ? 1 : 0;
      line++;
      endRecord();
    } else {
      field += char;
    }
    i++;
  }

  if (inQuotes) {
    throw new CsvParseError(recordStartLine);
  }
  if (field !== '' || record.length > 0) {
    endRecord();
  }
  return records;
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

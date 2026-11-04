import {strFromU8, unzipSync} from 'fflate';
import readXlsxFile from 'read-excel-file/universal';
import {cellToText, type ReadCell} from './cells';

/** One sheet as a table of text; `rows` may have different lengths. */
export interface Sheet {
  name: string;
  rows: string[][];
}

/** A cell with an Excel error such as `#DIV/0!`; its value is unknown. */
export class ExcelCellError extends Error {
  constructor(
    readonly sheet: string,
    readonly cell: string,
  ) {
    super(`Cell ${cell} in sheet ${sheet} contains an error`);
    this.name = 'ExcelCellError';
  }
}

/** Reads all sheets with the stored values (see `cellToText`). */
export async function readWorkbook(bytes: Uint8Array): Promise<Sheet[]> {
  const errorCell = findErrorCell(bytes);
  if (errorCell) {
    throw new ExcelCellError(errorCell.sheet, errorCell.cell);
  }
  // `universal` starts no Web Worker, which the CSP and file:// would block.
  const sheets = await readXlsxFile(toArrayBuffer(bytes), {
    trim: false,
    parseNumber: (text) => text,
  });
  return sheets.map(({sheet, data}) => ({
    name: sheet,
    // The library types a date cell as `typeof Date`; it is a `Date` object.
    rows: data.map((row) => row.map((cell) => cellToText(cell as ReadCell))),
  }));
}

/**
 * read-excel-file reads error cells as empty cells. Encrypting an empty cell
 * instead would lose data without notice, so this finds them first.
 */
export function findErrorCell(
  bytes: Uint8Array,
): {sheet: string; cell: string} | null {
  const files = unzipSync(bytes, {
    filter: ({name}) =>
      name === 'xl/workbook.xml' ||
      name === 'xl/_rels/workbook.xml.rels' ||
      name.startsWith('xl/worksheets/'),
  });
  for (const [path, name] of sheetNamesByPath(files)) {
    const cell = firstErrorCell(textFile(files, path));
    if (cell) {
      return {sheet: name, cell};
    }
  }
  return null;
}

/** A missing file reads as empty; read-excel-file reports broken files. */
function textFile(files: Record<string, Uint8Array>, path: string): string {
  const bytes = files[path];
  return bytes ? strFromU8(bytes) : '';
}

/** `xl/worksheets/sheet1.xml` → `Patienten`, in the order of the workbook. */
function sheetNamesByPath(
  files: Record<string, Uint8Array>,
): Map<string, string> {
  const workbook = textFile(files, 'xl/workbook.xml');
  const relations = textFile(files, 'xl/_rels/workbook.xml.rels');
  const targets = new Map(
    tags(relations, 'Relationship')
      .filter((attributes) => Boolean(attributes.Target))
      .map((attributes) => [attributes.Id, sheetPath(attributes.Target)]),
  );
  const result = new Map<string, string>();
  for (const attributes of tags(workbook, 'sheet')) {
    const id = Object.entries(attributes).find(([key]) =>
      key.endsWith(':id'),
    )?.[1];
    const path = id && targets.get(id);
    if (path) {
      result.set(path, unescapeXml(attributes.name ?? ''));
    }
  }
  return result;
}

/** Targets are relative to `xl/`, or absolute from the archive root. */
function sheetPath(target: string): string {
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

function firstErrorCell(sheetXml: string): string | null {
  const cell = tags(sheetXml, 'c').find((attributes) => attributes.t === 'e');
  return cell?.r ?? null;
}

/** The attributes of each start tag `<name …>` or `<name …/>`. */
function tags(xml: string, name: string): Record<string, string>[] {
  const pattern = new RegExp(`<${name}\\b([^>]*)>`, 'g');
  return [...xml.matchAll(pattern)].map(([, attributeText]) =>
    Object.fromEntries(
      [...attributeText.matchAll(/([\w:]+)="([^"]*)"/g)].map(
        ([, key, value]) => [key, value],
      ),
    ),
  );
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function unescapeXml(text: string): string {
  return text.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_, entity: string) => XML_ENTITIES[entity],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

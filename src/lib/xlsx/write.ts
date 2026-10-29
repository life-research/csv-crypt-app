import writeXlsxFile from 'write-excel-file/universal';
import type {WriteCell} from './cells';

export interface SheetToWrite {
  name: string;
  rows: WriteCell[][];
}

/** Writes all sheets, in the given order, to one .xlsx file. */
export async function writeWorkbook(
  sheets: SheetToWrite[],
): Promise<Uint8Array<ArrayBuffer>> {
  // `universal` starts no Web Worker, which the CSP and file:// would block.
  const blob = await writeXlsxFile(
    sheets.map(({name, rows}) => ({sheet: name, data: rows})),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

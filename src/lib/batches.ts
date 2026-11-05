/**
 * Processes records in batches. Between two batches, it reports progress,
 * stops if the user cancelled, and gives control back to the browser, so
 * that the page stays responsive. Only one batch of intermediate results
 * exists at a time.
 */
import type {CsvRecord} from './csv/csv';

/** Rows per batch: large enough to be fast, small enough for low memory. */
export const BATCH_SIZE = 1000;

export interface ProgressOptions {
  /** Cancels the work; the promise then rejects with an `AbortError`. */
  signal?: AbortSignal;
  /** Called after each batch with the processed share, from 0 to 1. */
  onProgress?: (fraction: number) => void;
}

export interface BatchOptions extends ProgressOptions {
  batchSize?: number;
  /** Gives control back to the browser; replaceable in tests. */
  pause?: () => Promise<void>;
}

/** Handles one batch. Returns `false` to stop after this batch. */
export type BatchHandler = (records: CsvRecord[]) => Promise<boolean>;

/**
 * Runs `handle` on the records in batches. `textLength` is the length of the
 * text the records come from; it gives the progress. Returns the number of
 * records that it read.
 */
export async function forEachBatch(
  records: Iterable<CsvRecord>,
  textLength: number,
  handle: BatchHandler,
  {
    signal,
    onProgress,
    batchSize = BATCH_SIZE,
    pause = pauseForBrowser,
  }: BatchOptions = {},
): Promise<number> {
  let batch: CsvRecord[] = [];
  let count = 0;

  const runBatch = async (end: number): Promise<boolean> => {
    signal?.throwIfAborted();
    const proceed = await handle(batch);
    batch = [];
    // A batch has at least one record, so the text is not empty.
    onProgress?.(end / textLength);
    await pause();
    signal?.throwIfAborted();
    return proceed;
  };

  for (const record of records) {
    batch.push(record);
    count++;
    if (batch.length >= batchSize && !(await runBatch(record.end))) {
      return count;
    }
  }
  if (batch.length > 0) {
    await runBatch(textLength);
  }
  return count;
}

/** A macrotask lets the browser repaint and handle clicks (e.g. Cancel). */
function pauseForBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** True if the work stopped because the user cancelled it. */
export function isCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

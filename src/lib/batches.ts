/**
 * Processes records in batches. Between two batches, it gives control back
 * to the browser, so that the page stays responsive. Only one batch of
 * intermediate results exists at a time.
 */

/** Rows per batch: large enough to be fast, small enough for low memory. */
export const BATCH_SIZE = 1000;

export interface BatchOptions {
  batchSize?: number;
  /** Gives control back to the browser; replaceable in tests. */
  pause?: () => Promise<void>;
}

/**
 * Handles one batch. `firstIndex` is the index of its first record in the
 * file. Returns `false` to stop after this batch.
 */
export type BatchHandler = (
  records: string[][],
  firstIndex: number,
) => Promise<boolean>;

/**
 * Runs `handle` on the records in batches. Returns the number of records
 * that it read.
 */
export async function forEachBatch(
  records: Iterable<string[]>,
  handle: BatchHandler,
  {batchSize = BATCH_SIZE, pause = pauseForBrowser}: BatchOptions = {},
): Promise<number> {
  let batch: string[][] = [];
  let count = 0;

  const runBatch = async (): Promise<boolean> => {
    const proceed = await handle(batch, count - batch.length);
    batch = [];
    await pause();
    return proceed;
  };

  for (const record of records) {
    batch.push(record);
    count++;
    if (batch.length >= batchSize && !(await runBatch())) {
      return count;
    }
  }
  if (batch.length > 0) {
    await runBatch();
  }
  return count;
}

/** A macrotask lets the browser repaint and handle input. */
function pauseForBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

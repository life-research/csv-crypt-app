import {describe, expect, it, vi} from 'vitest';
import {forEachBatch, type BatchHandler} from './batches';
import {readCsv} from './csv/csv';

const TEXT = 'a\nb\nc\nd\ne\n';
const noPause = () => Promise.resolve();

/** Collects the batches that the handler gets. */
function recorder(stopAfter = Infinity) {
  const batches: {records: string[][]; firstIndex: number}[] = [];
  const handle: BatchHandler = async (records, firstIndex) => {
    batches.push({records, firstIndex});
    return batches.length < stopAfter;
  };
  return {batches, handle};
}

describe('forEachBatch', () => {
  it('gives the records in batches with the index of the first record', async () => {
    const {batches, handle} = recorder();
    const count = await forEachBatch(readCsv(TEXT, ','), handle, {
      batchSize: 2,
      pause: noPause,
    });
    expect(count).toBe(5);
    expect(batches).toEqual([
      {records: [['a'], ['b']], firstIndex: 0},
      {records: [['c'], ['d']], firstIndex: 2},
      {records: [['e']], firstIndex: 4},
    ]);
  });

  it('handles no batch for an empty text', async () => {
    const {batches, handle} = recorder();
    const count = await forEachBatch(readCsv('', ','), handle, {
      pause: noPause,
    });
    expect(count).toBe(0);
    expect(batches).toHaveLength(0);
  });

  it('stops after a batch whose handler returns false', async () => {
    const {batches, handle} = recorder(1);
    const count = await forEachBatch(readCsv(TEXT, ','), handle, {
      batchSize: 2,
      pause: noPause,
    });
    expect(batches).toHaveLength(1);
    expect(count).toBe(2);
  });

  it('reads no more records than the batches need', async () => {
    const read: string[] = [];
    function* records() {
      for (const record of readCsv(TEXT, ',')) {
        read.push(record[0]);
        yield record;
      }
    }
    await forEachBatch(records(), recorder(1).handle, {
      batchSize: 2,
      pause: noPause,
    });
    expect(read).toEqual(['a', 'b']);
  });

  it('pauses after each batch', async () => {
    const pause = vi.fn(noPause);
    await forEachBatch(readCsv(TEXT, ','), recorder().handle, {
      batchSize: 2,
      pause,
    });
    expect(pause).toHaveBeenCalledTimes(3);
  });

  it('gives control back to the event loop with the default pause', async () => {
    let timerRan = false;
    setTimeout(() => (timerRan = true), 0);
    await forEachBatch(readCsv('a\n', ','), recorder().handle);
    expect(timerRan).toBe(true);
  });
});

import {describe, expect, it, vi} from 'vitest';
import {forEachBatch, isCancelled, type BatchHandler} from './batches';
import {readCsv} from './csv/csv';

const TEXT = 'a\nb\nc\nd\ne\n';
const noPause = () => Promise.resolve();

/** Collects the fields and start lines of the batches that the handler gets. */
function recorder(stopAfter = Infinity) {
  const batches: {fields: string[][]; lines: number[]}[] = [];
  const handle: BatchHandler = async (records) => {
    batches.push({
      fields: records.map(({fields}) => fields),
      lines: records.map(({line}) => line),
    });
    return batches.length < stopAfter;
  };
  return {batches, handle};
}

describe('forEachBatch', () => {
  it('gives the records in batches with their start lines', async () => {
    const {batches, handle} = recorder();
    const count = await forEachBatch(readCsv(TEXT, ','), TEXT.length, handle, {
      batchSize: 2,
      pause: noPause,
    });
    expect(count).toBe(5);
    expect(batches).toEqual([
      {fields: [['a'], ['b']], lines: [1, 2]},
      {fields: [['c'], ['d']], lines: [3, 4]},
      {fields: [['e']], lines: [5]},
    ]);
  });

  it('reports the progress after each batch, up to 1', async () => {
    const onProgress = vi.fn();
    await forEachBatch(readCsv(TEXT, ','), TEXT.length, recorder().handle, {
      batchSize: 2,
      pause: noPause,
      onProgress,
    });
    expect(onProgress.mock.calls).toEqual([[0.4], [0.8], [1]]);
  });

  it('handles no batch for an empty text', async () => {
    const onProgress = vi.fn();
    const count = await forEachBatch(readCsv('', ','), 0, recorder().handle, {
      pause: noPause,
      onProgress,
    });
    expect(count).toBe(0);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('stops after a batch whose handler returns false', async () => {
    const {batches, handle} = recorder(1);
    const count = await forEachBatch(readCsv(TEXT, ','), TEXT.length, handle, {
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
        read.push(record.fields[0]);
        yield record;
      }
    }
    await forEachBatch(records(), TEXT.length, recorder(1).handle, {
      batchSize: 2,
      pause: noPause,
    });
    expect(read).toEqual(['a', 'b']);
  });

  it('pauses after each batch', async () => {
    const pause = vi.fn(noPause);
    await forEachBatch(readCsv(TEXT, ','), TEXT.length, recorder().handle, {
      batchSize: 2,
      pause,
    });
    expect(pause).toHaveBeenCalledTimes(3);
  });

  it('stops with an AbortError when cancelled during a pause', async () => {
    const controller = new AbortController();
    const {batches, handle} = recorder();
    const work = forEachBatch(readCsv(TEXT, ','), TEXT.length, handle, {
      batchSize: 2,
      signal: controller.signal,
      pause: async () => controller.abort(),
    });
    await expect(work).rejects.toSatisfy(isCancelled);
    expect(batches).toHaveLength(1);
  });

  it('does not start when already cancelled', async () => {
    const {batches, handle} = recorder();
    const work = forEachBatch(readCsv(TEXT, ','), TEXT.length, handle, {
      signal: AbortSignal.abort(),
      pause: noPause,
    });
    await expect(work).rejects.toSatisfy(isCancelled);
    expect(batches).toHaveLength(0);
  });

  it('gives control back to the event loop with the default pause', async () => {
    let timerRan = false;
    setTimeout(() => (timerRan = true), 0);
    await forEachBatch(readCsv('a\n', ','), 2, recorder().handle);
    expect(timerRan).toBe(true);
  });
});

describe('isCancelled', () => {
  it('is true only for an AbortError', () => {
    expect(isCancelled(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isCancelled(new DOMException('x', 'TimeoutError'))).toBe(false);
    expect(isCancelled(new Error('x'))).toBe(false);
  });
});

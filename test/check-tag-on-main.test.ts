import {describe, expect, it, vi} from 'vitest';
import {fetchCompareStatus, isInHistory} from '../scripts/check-tag-on-main.js';

describe('isInHistory', () => {
  it.each(['identical', 'behind'])('accepts %s', (status) => {
    expect(isInHistory(status)).toBe(true);
  });

  it.each(['ahead', 'diverged', ''])('rejects "%s"', (status) => {
    expect(isInHistory(status)).toBe(false);
  });
});

describe('fetchCompareStatus', () => {
  const options = {
    repository: 'life-research/csv-crypt-app',
    base: 'main',
    head: 'abc123',
    token: 'secret',
  };

  function fakeFetch(response: Partial<Response>) {
    return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
  }

  it('compares the commit with the branch', async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({status: 'behind'}),
    });

    await expect(fetchCompareStatus({...options, fetchFn})).resolves.toBe(
      'behind',
    );
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/life-research/csv-crypt-app/compare/main...abc123?per_page=1',
      {
        headers: expect.objectContaining({Authorization: 'Bearer secret'}),
      },
    );
  });

  it('fails on an API error', async () => {
    const fetchFn = fakeFetch({ok: false, status: 404});

    await expect(fetchCompareStatus({...options, fetchFn})).rejects.toThrow(
      '404',
    );
  });
});

import {createServer} from 'node:net';
import {describe, expect, it, vi} from 'vitest';
import {appEnvironment, findFreePort, waitForCdp} from '../e2e-desktop/launch';

const ENDPOINT = 'http://127.0.0.1:9222';

/** A clock that only moves when the code under test sleeps. */
function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
  };
}

function fetchAnswering(...answers: Array<boolean | 'refused'>) {
  const fetchFn = vi.fn();
  for (const answer of answers) {
    if (answer === 'refused') {
      fetchFn.mockRejectedValueOnce(new TypeError('fetch failed'));
    } else {
      fetchFn.mockResolvedValueOnce({ok: answer});
    }
  }
  return fetchFn as unknown as typeof fetch;
}

describe('waitForCdp', () => {
  it('waits until the endpoint answers', async () => {
    const fetchFn = fetchAnswering('refused', false, true);

    await waitForCdp(ENDPOINT, {isAlive: () => true, fetchFn, ...fakeClock()});

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn).toHaveBeenLastCalledWith(`${ENDPOINT}/json/version`);
  });

  it('fails after the timeout', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      waitForCdp(ENDPOINT, {
        isAlive: () => true,
        timeoutMs: 1000,
        intervalMs: 250,
        fetchFn,
        ...fakeClock(),
      }),
    ).rejects.toThrow('No CDP endpoint at http://127.0.0.1:9222 after 1000 ms');
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it('fails at once when the app exited', async () => {
    const fetchFn = fetchAnswering(true);

    await expect(
      waitForCdp(ENDPOINT, {isAlive: () => false, fetchFn, ...fakeClock()}),
    ).rejects.toThrow('The app exited');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('findFreePort', () => {
  it('gives a port that a server can use', async () => {
    const port = await findFreePort();
    const server = createServer();

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    server.close();

    expect(port).toBeGreaterThan(0);
  });
});

describe('appEnvironment', () => {
  it('opens the CDP port and uses its own user data folder', () => {
    const env = appEnvironment(9222, 'C:\\Temp\\webview2', {PATH: 'C:\\bin'});

    expect(env).toEqual({
      PATH: 'C:\\bin',
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222',
      WEBVIEW2_USER_DATA_FOLDER: 'C:\\Temp\\webview2',
    });
  });

  it('replaces values of the base environment', () => {
    const env = appEnvironment(1, 'new', {
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--other',
      WEBVIEW2_USER_DATA_FOLDER: 'old',
    });

    expect(env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS).toBe(
      '--remote-debugging-port=1',
    );
    expect(env.WEBVIEW2_USER_DATA_FOLDER).toBe('new');
  });
});

// Starts the desktop app and connects Playwright to its WebView2 page.
// Playwright cannot start the executable itself: WebView2 opens a port for
// the Chrome DevTools Protocol (CDP), and Playwright connects to it.
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium, type Browser, type Page} from '@playwright/test';

export interface WaitOptions {
  /** False when the app exited: waiting longer is useless. */
  isAlive: () => boolean;
  timeoutMs?: number;
  intervalMs?: number;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const sleepFor = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits until the CDP endpoint answers. WebView2 opens it only after start. */
export async function waitForCdp(
  endpoint: string,
  {
    isAlive,
    timeoutMs = 30_000,
    intervalMs = 250,
    fetchFn = fetch,
    now = Date.now,
    sleep = sleepFor,
  }: WaitOptions,
): Promise<void> {
  const deadline = now() + timeoutMs;
  while (true) {
    if (!isAlive()) {
      throw new Error('The app exited before WebView2 opened the CDP port');
    }
    if (await answers(`${endpoint}/json/version`, fetchFn)) {
      return;
    }
    if (now() >= deadline) {
      throw new Error(`No CDP endpoint at ${endpoint} after ${timeoutMs} ms`);
    }
    await sleep(intervalMs);
  }
}

async function answers(url: string, fetchFn: typeof fetch): Promise<boolean> {
  try {
    return (await fetchFn(url)).ok;
  } catch {
    // Connection refused: the port is not open yet.
    return false;
  }
}

/** A port that is free now. The OS selects it. */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('No port')),
      );
    });
  });
}

export interface App {
  page: Page;
  processId: number;
  close(): Promise<void>;
}

/**
 * The environment of the app. Each start gets its own WebView2 user data
 * folder: a WebView2 browser process of an earlier start (for example from
 * the start check in CI) can still run on the default folder. A new start
 * then uses that process, and WebView2 ignores the new browser arguments,
 * so the CDP port never opens.
 */
export function appEnvironment(
  port: number,
  userDataFolder: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    WEBVIEW2_USER_DATA_FOLDER: userDataFolder,
  };
}

export async function launchApp(executable: string): Promise<App> {
  const port = await findFreePort();
  const endpoint = `http://127.0.0.1:${port}`;
  const userDataFolder = await mkdtemp(join(tmpdir(), 'csv-crypt-webview2-'));
  const child = spawn(executable, [], {
    env: appEnvironment(port, userDataFolder),
    stdio: 'inherit',
  });
  const stop = async () => {
    child.kill();
    await removeFolder(userDataFolder);
  };
  try {
    await waitForCdp(endpoint, {isAlive: () => isRunning(child)});
    const browser = await chromium.connectOverCDP(endpoint);
    const page = await firstPage(browser);
    return {
      page,
      processId: child.pid!,
      close: async () => {
        await browser.close();
        await stop();
      },
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

/** WebView2 processes can hold files for a short time after the app exits. */
async function removeFolder(folder: string): Promise<void> {
  try {
    await rm(folder, {recursive: true, force: true, maxRetries: 10});
  } catch (error) {
    // A left-over temporary folder must not fail the test.
    console.warn(`Could not remove ${folder}: ${String(error)}`);
  }
}

function isRunning(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

/** WebView2 can open the CDP port before it has created the page. */
async function firstPage(browser: Browser): Promise<Page> {
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent('page'));
  await page.waitForLoadState();
  return page;
}

import {describe, expect, it} from 'vitest';
import {base64ToBytes} from './base64';
import {importHexKey} from './key';
import {decryptLine, encryptLine} from './line';
import {parseCsv} from '../csv/csv';
import {fixedRandom, readFixtureText, TEST_KEY} from '../test-support';

const keys = await importHexKey(TEST_KEY);

function cliLines(name: string): string[][] {
  return parseCsv(readFixtureText(`cli/${name}.crypt.csv`), ',');
}

describe('decryptLine with CLI output', () => {
  it('decrypts every line the CLI encrypted', async () => {
    const lines = cliLines('example-comma-utf8');
    const results = await Promise.all(lines.map((l) => decryptLine(keys, l)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results[0]).toEqual({ok: true, fields: ['id', 'd1', 'd2']});
  });
});

describe('encryptLine', () => {
  it.each(['example-comma-utf8', 'edge-cases'])(
    'gives the same bytes as the CLI for the same IV (%s)',
    async (name) => {
      for (const line of cliLines(name)) {
        if (line.length < 2) {
          continue;
        }
        const decrypted = await decryptLine(keys, line);
        if (!decrypted.ok) {
          throw new Error(`cannot decrypt ${line[0]}`);
        }
        const iv = base64ToBytes(line[1])!.slice(0, 16);
        const encrypted = await encryptLine(
          keys,
          decrypted.fields,
          fixedRandom(iv),
        );
        expect(encrypted).toEqual(line);
      }
    },
  );

  it('keeps a line with one column unchanged', async () => {
    expect(await encryptLine(keys, ['only-id'])).toEqual(['only-id']);
  });

  it('uses a new IV for each line', async () => {
    const a = await encryptLine(keys, ['1', 'same']);
    const b = await encryptLine(keys, ['1', 'same']);
    expect(a[1]).not.toBe(b[1]);
  });

  it('round-trips', async () => {
    const fields = ['id', 'äöü', '', 'x,y', '"q"'];
    expect(await decryptLine(keys, await encryptLine(keys, fields))).toEqual({
      ok: true,
      fields,
    });
  });
});

describe('decryptLine errors', () => {
  it('keeps a line with one column unchanged', async () => {
    expect(await decryptLine(keys, ['only-id'])).toEqual({
      ok: true,
      fields: ['only-id'],
    });
  });

  it.each([
    ['empty', ''],
    ['too short', Buffer.alloc(31).toString('base64')],
    ['not Base64', '!!!'],
  ])('reports invalid cipher text: %s', async (_name, value) => {
    expect(await decryptLine(keys, ['id', value])).toEqual({
      ok: false,
      error: 'invalid-cipher-text',
    });
  });

  it('reports a wrong key', async () => {
    const otherKeys = await importHexKey('00'.repeat(32));
    const [line] = cliLines('example-comma-utf8');
    expect(await decryptLine(otherKeys, line)).toEqual({
      ok: false,
      error: 'wrong-key-or-corrupt',
    });
  });

  it('reports a manipulated cipher text', async () => {
    const [first, encrypted] = cliLines('example-comma-utf8')[0];
    const bytes = base64ToBytes(encrypted)!;
    bytes[20] ^= 1;
    const manipulated = Buffer.from(bytes).toString('base64');
    expect(await decryptLine(keys, [first, manipulated])).toEqual({
      ok: false,
      error: 'wrong-key-or-corrupt',
    });
  });
});

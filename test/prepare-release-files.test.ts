import {spawnSync} from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  buildVersion,
  checksumLine,
  FIXED_NAME,
  prepareReleaseFiles,
  releaseNames,
  sha256,
  slsaSubject,
} from '../scripts/prepare-release-files.js';

describe('buildVersion', () => {
  it('is the plain version for a tag build', () => {
    expect(buildVersion('1.2.3')).toBe('1.2.3');
  });

  it('contains the commit for a dev build', () => {
    expect(buildVersion('1.2.3', '3f2a9c1')).toBe('1.2.3-dev.3f2a9c1');
  });
});

describe('releaseNames', () => {
  it('gives a tag build the versioned and the fixed name', () => {
    expect(releaseNames('1.2.3')).toEqual([
      'csv-crypt-1.2.3-windows-x64',
      'csv-crypt-windows-x64',
    ]);
  });

  it('gives a dev build only the name with the commit', () => {
    expect(releaseNames('1.2.3', '3f2a9c1')).toEqual([
      'csv-crypt-1.2.3-dev.3f2a9c1-windows-x64',
    ]);
  });

  it('never gives a dev build the fixed name', () => {
    expect(releaseNames('1.2.3', '3f2a9c1')).not.toContain(FIXED_NAME);
  });
});

describe('checksumLine', () => {
  it('has the sha256sum format with an LF line ending', () => {
    expect(checksumLine('ab12', 'app.exe')).toBe('ab12  app.exe\n');
  });
});

describe('slsaSubject', () => {
  it('encodes all lines together in base64', () => {
    const lines = ['ab12  a.exe\n', 'ab12  b.exe\n'];
    expect(Buffer.from(slsaSubject(lines), 'base64').toString('utf8')).toBe(
      'ab12  a.exe\nab12  b.exe\n',
    );
  });
});

describe('sha256', () => {
  it('gives the lowercase hex hash', () => {
    expect(sha256(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('prepareReleaseFiles', () => {
  const content = Buffer.from('fake executable');
  const hash = sha256(content);
  let workDir: string;
  let exePath: string;
  let outDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'prepare-release-files-'));
    exePath = join(workDir, 'csv-crypt.exe');
    outDir = join(workDir, 'dist');
    writeFileSync(exePath, content);
  });

  afterEach(() => {
    rmSync(workDir, {recursive: true, force: true});
  });

  const readOut = (file: string) => readFileSync(join(outDir, file));

  describe('tag build', () => {
    it('writes both executables with the same content', () => {
      prepareReleaseFiles({exePath, outDir, version: '1.2.3'});
      expect(readOut('csv-crypt-1.2.3-windows-x64.exe')).toEqual(content);
      expect(readOut('csv-crypt-windows-x64.exe')).toEqual(content);
    });

    it('writes one checksum file for each executable', () => {
      prepareReleaseFiles({exePath, outDir, version: '1.2.3'});
      expect(readOut('csv-crypt-1.2.3-windows-x64.exe.sha256').toString()).toBe(
        `${hash}  csv-crypt-1.2.3-windows-x64.exe\n`,
      );
      expect(readOut('csv-crypt-windows-x64.exe.sha256').toString()).toBe(
        `${hash}  csv-crypt-windows-x64.exe\n`,
      );
    });

    it('writes no other files', () => {
      prepareReleaseFiles({exePath, outDir, version: '1.2.3'});
      expect(readdirSync(outDir).sort()).toEqual([
        'csv-crypt-1.2.3-windows-x64.exe',
        'csv-crypt-1.2.3-windows-x64.exe.sha256',
        'csv-crypt-windows-x64.exe',
        'csv-crypt-windows-x64.exe.sha256',
      ]);
    });

    it('returns the versioned name, the version and both names in the subject', () => {
      const result = prepareReleaseFiles({exePath, outDir, version: '1.2.3'});
      expect(result).toEqual({
        name: 'csv-crypt-1.2.3-windows-x64',
        version: '1.2.3',
        hash,
        subjectB64: slsaSubject([
          `${hash}  csv-crypt-1.2.3-windows-x64.exe\n`,
          `${hash}  csv-crypt-windows-x64.exe\n`,
        ]),
      });
    });
  });

  describe('dev build', () => {
    it('writes only the executable with the commit and its checksum', () => {
      prepareReleaseFiles({
        exePath,
        outDir,
        version: '1.2.3',
        commit: '3f2a9c1',
      });
      expect(readdirSync(outDir).sort()).toEqual([
        'csv-crypt-1.2.3-dev.3f2a9c1-windows-x64.exe',
        'csv-crypt-1.2.3-dev.3f2a9c1-windows-x64.exe.sha256',
      ]);
    });

    it('returns the dev version and only one name in the subject', () => {
      const result = prepareReleaseFiles({
        exePath,
        outDir,
        version: '1.2.3',
        commit: '3f2a9c1',
      });
      expect(result.version).toBe('1.2.3-dev.3f2a9c1');
      expect(result.subjectB64).toBe(
        slsaSubject([`${hash}  csv-crypt-1.2.3-dev.3f2a9c1-windows-x64.exe\n`]),
      );
    });
  });
});

describe('command line', () => {
  const script = join(
    import.meta.dirname,
    '../scripts/prepare-release-files.js',
  );
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'prepare-release-files-cli-'));
  });

  afterEach(() => {
    rmSync(workDir, {recursive: true, force: true});
  });

  it('prints the outputs for GITHUB_OUTPUT on stdout', () => {
    const exePath = join(workDir, 'csv-crypt.exe');
    writeFileSync(exePath, 'fake executable');
    const run = spawnSync(
      process.execPath,
      [script, exePath, join(workDir, 'dist'), '1.2.3', '3f2a9c1'],
      {encoding: 'utf8'},
    );
    expect(run.status).toBe(0);
    const outputs = run.stdout.trim().split('\n');
    expect(outputs).toEqual([
      'name=csv-crypt-1.2.3-dev.3f2a9c1-windows-x64',
      'version=1.2.3-dev.3f2a9c1',
      expect.stringMatching(/^subject-b64=[A-Za-z0-9+/]+=*$/),
    ]);
    expect(run.stderr).toContain('SHA-256:');
  });

  it('fails with a usage message when arguments are missing', () => {
    const run = spawnSync(process.execPath, [script, 'only-one'], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Usage:');
  });
});

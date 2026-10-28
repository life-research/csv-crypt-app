import {describe, expect, it} from 'vitest';
import {
  cargoPackageVersion,
  findVersionMismatches,
  readVersions,
  tagVersion,
} from '../scripts/check-version.js';

describe('cargoPackageVersion', () => {
  it('reads the version of the package, not of a dependency', () => {
    const cargoToml = [
      '[package]',
      'name = "csv-crypt"',
      'version = "1.2.3"',
      '',
      '[dependencies]',
      'serde = { version = "1" }',
      'version = "9.9.9"',
    ].join('\n');
    expect(cargoPackageVersion(cargoToml)).toBe('1.2.3');
  });

  it('fails without a version in [package]', () => {
    const cargoToml = '[package]\nname = "x"\n\n[dependencies]\nversion = "1"';
    expect(() => cargoPackageVersion(cargoToml)).toThrow('no version');
  });
});

describe('tagVersion', () => {
  it('removes the leading v', () => {
    expect(tagVersion('v1.2.3')).toBe('1.2.3');
  });

  it.each(['1.2.3', 'v1.2', 'v1.2.3-rc.1', 'release-1.2.3'])(
    'rejects %s',
    (tag) => {
      expect(() => tagVersion(tag)).toThrow('vX.Y.Z');
    },
  );
});

describe('findVersionMismatches', () => {
  it('finds nothing when all versions are equal', () => {
    expect(findVersionMismatches({a: '1.0.0', b: '1.0.0', c: '1.0.0'})).toEqual(
      [],
    );
  });

  it('names each source that differs from the first one', () => {
    expect(
      findVersionMismatches({tag: '1.0.0', a: '1.0.0', b: '0.9.0'}),
    ).toEqual(['b has 0.9.0, but tag has 1.0.0']);
  });
});

describe('readVersions', () => {
  it('has the same version in package.json and Cargo.toml', () => {
    expect(findVersionMismatches(readVersions())).toEqual([]);
  });

  it('puts the tag first', () => {
    const versions = readVersions('v0.0.1');
    expect(Object.keys(versions)[0]).toBe('tag v0.0.1');
    expect(findVersionMismatches(versions)).not.toEqual([]);
  });
});

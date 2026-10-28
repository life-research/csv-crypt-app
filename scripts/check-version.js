// Checks that the release tag and all version fields name the same version.
// Usage: node scripts/check-version.js [tag]   (tag like v1.2.3, optional)
// Prints the version on success, exits with 1 on a mismatch.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

/**
 * Reads `version` from the [package] table of a Cargo.toml.
 * @param {string} cargoToml
 * @returns {string}
 */
export function cargoPackageVersion(cargoToml) {
  const packageTable = cargoToml
    .split(/^\[/m)
    .find((table) => table.startsWith('package]'));
  const match = packageTable?.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Cargo.toml has no version in [package]');
  }
  return match[1];
}

/**
 * `v1.2.3` → `1.2.3`
 * @param {string} tag
 * @returns {string}
 */
export function tagVersion(tag) {
  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag);
  if (!match) {
    throw new Error(`Tag is not of the form vX.Y.Z: ${tag}`);
  }
  return match[1];
}

/**
 * One message for each source whose version differs from the first source.
 * @param {Record<string, string>} versions source → version
 * @returns {string[]}
 */
export function findVersionMismatches(versions) {
  const [[firstSource, expected], ...others] = Object.entries(versions);
  return others
    .filter(([, version]) => version !== expected)
    .map(
      ([source, version]) =>
        `${source} has ${version}, but ${firstSource} has ${expected}`,
    );
}

/**
 * The versions of this repository, with the tag first if there is one.
 * @param {string} [tag]
 * @returns {Record<string, string>}
 */
export function readVersions(tag) {
  const versions = {
    'package.json': JSON.parse(readFileSync('package.json', 'utf8')).version,
    'src-tauri/Cargo.toml': cargoPackageVersion(
      readFileSync('src-tauri/Cargo.toml', 'utf8'),
    ),
  };
  return tag ? {[`tag ${tag}`]: tagVersion(tag), ...versions} : versions;
}

/** @param {string} [tag] */
function main(tag) {
  const versions = readVersions(tag);
  const mismatches = findVersionMismatches(versions);
  if (mismatches.length > 0) {
    mismatches.forEach((mismatch) => console.error(mismatch));
    process.exit(1);
  }
  console.log(Object.values(versions)[0]);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]);
}

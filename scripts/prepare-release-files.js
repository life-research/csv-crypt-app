// Copies the Windows executable into the release folder under its release
// names and writes one checksum file for each copy.
//
// A tag build (official release) gets two names with the same content:
//   csv-crypt-X.Y.Z-windows-x64.exe   (name with the version)
//   csv-crypt-windows-x64.exe         (fixed name for the link
//                                      releases/latest/download/...)
// A dev build gets only the name with the commit:
//   csv-crypt-X.Y.Z-dev.<commit>-windows-x64.exe
//
// Usage: node scripts/prepare-release-files.js <exe> <out-dir> <version> [commit]
//   commit: short commit hash; only for a dev build, omit it for a tag build.
// Prints `name`, `version` and `subject-b64` as key=value lines for
// GITHUB_OUTPUT.
import {createHash} from 'node:crypto';
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const PRODUCT = 'csv-crypt';
const PLATFORM = 'windows-x64';

/** Name without extension that is the same in every release. */
export const FIXED_NAME = `${PRODUCT}-${PLATFORM}`;

/**
 * The version in the file name: the release version for a tag build,
 * with the commit for a dev build.
 * @param {string} version like 1.2.3
 * @param {string} [commit] short commit hash of a dev build
 * @returns {string}
 */
export function buildVersion(version, commit) {
  return commit ? `${version}-dev.${commit}` : version;
}

/**
 * Names without extension, the versioned name first. Only a tag build
 * (no commit) also gets the fixed name, so that an unofficial build never
 * has the name of the official download.
 * @param {string} version
 * @param {string} [commit]
 * @returns {string[]}
 */
export function releaseNames(version, commit) {
  const versionedName = `${PRODUCT}-${buildVersion(version, commit)}-${PLATFORM}`;
  return commit ? [versionedName] : [versionedName, FIXED_NAME];
}

/**
 * One line in the sha256sum format. LF line ending, so that
 * `sha256sum -c` also works on Linux.
 * @param {string} hash lowercase hex SHA-256
 * @param {string} fileName
 * @returns {string}
 */
export function checksumLine(hash, fileName) {
  return `${hash}  ${fileName}\n`;
}

/**
 * The SLSA generator takes the sha256sum output, base64 encoded.
 * @param {string[]} lines
 * @returns {string}
 */
export function slsaSubject(lines) {
  return Buffer.from(lines.join(''), 'utf8').toString('base64');
}

/**
 * @param {Buffer} content
 * @returns {string} lowercase hex SHA-256
 */
export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Copies the executable and writes the checksum files into outDir.
 * @param {{exePath: string, outDir: string, version: string, commit?: string}} options
 * @returns {{name: string, version: string, hash: string, subjectB64: string}}
 */
export function prepareReleaseFiles({exePath, outDir, version, commit}) {
  const hash = sha256(readFileSync(exePath));
  const names = releaseNames(version, commit);
  mkdirSync(outDir, {recursive: true});
  const lines = names.map((name) => {
    const exe = `${name}.exe`;
    const line = checksumLine(hash, exe);
    copyFileSync(exePath, join(outDir, exe));
    writeFileSync(join(outDir, `${exe}.sha256`), line);
    return line;
  });
  return {
    name: names[0],
    version: buildVersion(version, commit),
    hash,
    subjectB64: slsaSubject(lines),
  };
}

/** @param {string[]} args */
function main([exePath, outDir, version, commit]) {
  if (!exePath || !outDir || !version) {
    console.error(
      'Usage: node scripts/prepare-release-files.js <exe> <out-dir> <version> [commit]',
    );
    process.exit(1);
  }
  const result = prepareReleaseFiles({exePath, outDir, version, commit});
  // Log to stderr: stdout goes to GITHUB_OUTPUT.
  console.error(`${result.name}.exe SHA-256: ${result.hash}`);
  console.log(`name=${result.name}`);
  console.log(`version=${result.version}`);
  console.log(`subject-b64=${result.subjectB64}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}

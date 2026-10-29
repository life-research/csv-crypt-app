// Checks the merged SBOM of the desktop app before CI accepts it.
// Usage: node scripts/check-sbom.js <bom.cdx.json> <version>
// Exits with 1 and names each problem when the SBOM is incomplete.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

/** @typedef {{type?: string, name?: string, purl?: string}} Component */

/** Packages that the executable always contains, one per ecosystem part. */
export const requiredComponents = [
  'pkg:npm/svelte',
  'pkg:npm/%40sveltejs/kit',
  'pkg:cargo/tauri',
  'pkg:cargo/webview2-com',
];

/**
 * The package URL without version and qualifiers:
 * `pkg:npm/svelte@5.0.0?vcs_url=…` → `pkg:npm/svelte`
 * @param {string} purl
 * @returns {string}
 */
export function purlName(purl) {
  return purl.replace(/[@?#].*$/, '');
}

/**
 * @param {any} bom a parsed CycloneDX JSON document
 * @param {{name: string, version: string}} expected the root component
 * @returns {string[]} one message for each problem
 */
export function findSbomProblems(bom, expected) {
  const problems = [];
  const root = bom.metadata?.component ?? {};
  if (root.name !== expected.name || root.version !== expected.version) {
    problems.push(
      `Root component is ${root.name} ${root.version}, ` +
        `expected ${expected.name} ${expected.version}`,
    );
  }
  /** @type {Component[]} */
  const components = bom.components ?? [];
  const names = new Set(
    components.flatMap((c) => (c.purl ? [purlName(c.purl)] : [])),
  );
  for (const required of requiredComponents) {
    if (!names.has(required)) {
      problems.push(`Missing component ${required}`);
    }
  }
  for (const component of components) {
    if (!component.purl && component.type === 'library') {
      problems.push(`Component ${component.name} has no package URL`);
    }
  }
  return problems;
}

/**
 * @param {string} path
 * @param {string} version
 */
function main(path, version) {
  const bom = JSON.parse(readFileSync(path, 'utf8'));
  const {productName} = JSON.parse(
    readFileSync('src-tauri/tauri.conf.json', 'utf8'),
  );
  const problems = findSbomProblems(bom, {name: productName, version});
  if (problems.length > 0) {
    problems.forEach((problem) => console.error(problem));
    process.exit(1);
  }
  console.log(`${path}: ${bom.components.length} components`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv[3]);
}

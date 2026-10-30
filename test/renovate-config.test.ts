// Checks that the custom Renovate managers find every pinned CI tool. Renovate
// gives no error for a version it does not find; that version then gets old.
import {readdirSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

interface CustomManager {
  description: string;
  managerFilePatterns: string[];
  matchStrings: string[];
}

type Match = Record<string, string | undefined>;

const config = JSON.parse(readFileSync('renovate.json', 'utf8'));
const managers: CustomManager[] = config.customManagers;

const workflowDir = '.github/workflows';
const workflows = readdirSync(workflowDir).map((name) => ({
  path: `${workflowDir}/${name}`,
  text: readFileSync(`${workflowDir}/${name}`, 'utf8'),
}));

function managerFor(description: string): CustomManager {
  const manager = managers.find((m) => m.description.startsWith(description));
  if (!manager) {
    throw new Error(`no custom manager "${description}"`);
  }
  return manager;
}

/** `"/^a\\.b$/"` → `/^a\.b$/` (Renovate notation for a regex pattern) */
function toRegExp(pattern: string): RegExp {
  return new RegExp(pattern.slice(1, -1));
}

function appliesTo(manager: CustomManager, path: string): boolean {
  return manager.managerFilePatterns.some((p) => toRegExp(p).test(path));
}

/** Like Renovate: every match of every match string, as named groups. */
function extract(manager: CustomManager, text: string): Match[] {
  return manager.matchStrings.flatMap((matchString) =>
    [...text.matchAll(new RegExp(matchString, 'g'))].map((m) => ({
      ...m.groups,
    })),
  );
}

function extractFromWorkflows(description: string): Match[] {
  const manager = managerFor(description);
  return workflows
    .filter(({path}) => appliesTo(manager, path))
    .flatMap(({text}) => extract(manager, text));
}

function count(pattern: RegExp): number {
  return workflows.reduce(
    (sum, {text}) => sum + [...text.matchAll(pattern)].length,
    0,
  );
}

describe('tools with a checksum (# renovate: comments)', () => {
  const deps = extractFromWorkflows('Versions and checksums');

  it('finds every # renovate: comment', () => {
    expect(deps).toHaveLength(count(/# renovate:/g));
  });

  it('reads version and checksum', () => {
    expect(deps).toContainEqual(
      expect.objectContaining({
        datasource: 'github-release-attachments',
        depName: 'rhysd/actionlint',
        currentValue: expect.stringMatching(/^v\d+\.\d+\.\d+$/),
        currentDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it('reads a checksum for every *_CHECKSUM line', () => {
    const withDigest = deps.filter((dep) => dep.currentDigest);
    expect(withDigest).toHaveLength(count(/_CHECKSUM: /g));
  });

  it('uses the datasource that also updates the checksum', () => {
    const withDigest = deps.filter((dep) => dep.currentDigest);
    for (const dep of withDigest) {
      expect(dep.datasource).toBe('github-release-attachments');
    }
  });

  describe('cargo-audit', () => {
    const cargoAudit = deps.find((dep) => dep.depName === 'rustsec/rustsec');
    const extractVersion = new RegExp(cargoAudit?.extractVersion ?? '');

    it('takes the version from the cargo-audit tag', () => {
      expect('cargo-audit/v0.22.3'.match(extractVersion)?.groups).toEqual({
        version: 'v0.22.3',
      });
    });

    it('ignores the tags of the other rustsec crates', () => {
      expect('rustsec/v0.31.0').not.toMatch(extractVersion);
    });
  });
});

describe('tools of taiki-e/install-action', () => {
  const crates = extractFromWorkflows('Cargo tools');
  const cyclonedxCli = extractFromWorkflows('CycloneDX CLI');

  it('finds every tool', () => {
    const tools = workflows.flatMap(({text}) =>
      [...text.matchAll(/tool: (.+)/g)].flatMap((m) => m[1].split(',')),
    );
    expect(crates.length + cyclonedxCli.length).toBe(tools.length);
  });

  it('reads the crate names without the CycloneDX CLI', () => {
    expect(crates.map((dep) => dep.depName).sort()).toEqual([
      'cargo-cyclonedx',
      'cargo-llvm-cov',
    ]);
  });

  it('reads the version of the CycloneDX CLI', () => {
    expect(cyclonedxCli).toEqual([
      {currentValue: expect.stringMatching(/^\d+\.\d+\.\d+$/)},
    ]);
  });
});

import {describe, expect, it} from 'vitest';
import {
  findSbomProblems,
  purlName,
  requiredComponents,
} from '../scripts/check-sbom.js';

const expected = {name: 'CSV Crypt', version: '1.2.3'};

function library(purl: string) {
  return {type: 'library', name: purlName(purl), purl: `${purl}@1.0.0`};
}

function completeBom() {
  return {
    metadata: {component: {type: 'application', ...expected}},
    components: requiredComponents.map(library),
  };
}

describe('purlName', () => {
  it('removes version and qualifiers', () => {
    expect(purlName('pkg:npm/svelte@5.0.0?vcs_url=git%2Bhttps')).toBe(
      'pkg:npm/svelte',
    );
    expect(purlName('pkg:cargo/tauri@2.12.4')).toBe('pkg:cargo/tauri');
  });
});

describe('findSbomProblems', () => {
  it('accepts a complete SBOM', () => {
    expect(findSbomProblems(completeBom(), expected)).toEqual([]);
  });

  it('names a wrong root component', () => {
    expect(
      findSbomProblems(completeBom(), {name: 'CSV Crypt', version: '9.9.9'}),
    ).toEqual(['Root component is CSV Crypt 1.2.3, expected CSV Crypt 9.9.9']);
  });

  it('names each missing required component', () => {
    const bom = completeBom();
    bom.components = bom.components.filter(
      (c) => !c.purl.startsWith('pkg:cargo/'),
    );
    expect(findSbomProblems(bom, expected)).toEqual([
      'Missing component pkg:cargo/tauri',
      'Missing component pkg:cargo/webview2-com',
    ]);
  });

  it('names a library without package URL', () => {
    const bom = completeBom();
    bom.components.push({type: 'library', name: 'mystery', purl: ''});
    expect(findSbomProblems(bom, expected)).toEqual([
      'Component mystery has no package URL',
    ]);
  });

  it('names all problems of an empty document', () => {
    expect(findSbomProblems({}, expected)).toHaveLength(
      1 + requiredComponents.length,
    );
  });
});

import {describe, expect, it} from 'vitest';
import {de} from './de';
import {en} from './en';
import {detectLanguage, format} from './i18n';

describe('format', () => {
  it('replaces placeholders', () => {
    expect(format('Line {line}: {message}', {line: 3, message: 'x'})).toBe(
      'Line 3: x',
    );
  });

  it('keeps unknown placeholders', () => {
    expect(format('{a} {b}', {a: 1})).toBe('1 {b}');
  });
});

describe('detectLanguage', () => {
  it.each([
    ['en', ['de-DE'], 'en'],
    [null, ['en-US', 'de'], 'en'],
    [null, ['fr-FR', 'de-AT'], 'de'],
    [null, ['fr'], 'de'],
    ['xx', [], 'de'],
  ] as const)('stored %j, browser %j → %s', (stored, browser, expected) => {
    expect(detectLanguage(stored, browser)).toBe(expected);
  });
});

describe('dictionaries', () => {
  it('have the same placeholders in German and English', () => {
    const placeholders = (text: string) =>
      (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(de) as (keyof typeof de)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(de[key]));
    }
  });
});

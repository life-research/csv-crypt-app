import {de} from './de';

export type MessageKey = keyof typeof de;
export type Messages = Record<MessageKey, string>;
export type Language = 'de' | 'en';
export type Params = Record<string, string | number>;

export const LANGUAGES: Language[] = ['de', 'en'];

/** Replaces `{name}` placeholders with the given parameters. */
export function format(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * The stored choice wins. Else the first supported browser language.
 * German is the default, because most users are German-speaking.
 */
export function detectLanguage(
  stored: string | null,
  browserLanguages: readonly string[],
): Language {
  if (isLanguage(stored)) {
    return stored;
  }
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) {
      return base;
    }
  }
  return 'de';
}

function isLanguage(value: string | null): value is Language {
  return LANGUAGES.includes(value as Language);
}

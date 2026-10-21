import {de} from './de';
import {en} from './en';
import {
  detectLanguage,
  format,
  type Language,
  type MessageKey,
  type Params,
} from './i18n';

const STORAGE_KEY = 'csv-crypt.language';
const dictionaries: Record<Language, Record<MessageKey, string>> = {de, en};

let language = $state<Language>(
  typeof window !== 'undefined'
    ? detectLanguage(readStoredLanguage(), navigator.languages)
    : 'de',
);

export const i18n = {
  get language(): Language {
    return language;
  },
  set language(value: Language) {
    language = value;
    storeLanguage(value);
  },
  t(key: MessageKey, params?: Params): string {
    return format(dictionaries[language][key], params);
  },
};

// localStorage holds only the language, never keys or data.
// It can be unavailable (private mode, file://), so errors are ignored.
function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(value: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore: the choice then lasts only for this page view.
  }
}

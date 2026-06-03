import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import it from '../locales/it.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import nl from '../locales/nl.json';
import ptBR from '../locales/pt-BR.json';
import zhCN from '../locales/zh-CN.json';

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = [
  'en',
  'fr',
  'es',
  'de',
  'pt-BR',
  'zh-CN',
  'ko',
  'it',
  'nl',
  'ja',
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

type TranslationNode = string | { [key: string]: TranslationNode };
type TranslationMap = { [key: string]: TranslationNode };

const resources: Record<string, TranslationMap> = {
  en,
  fr,
  es,
  de,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
  ko,
  it,
  nl,
  ja,
};

const lookup = (map: TranslationMap, key: string): string | undefined => {
  const parts = key.split('.');
  let node: TranslationNode | undefined = map;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) {
      node = (node as { [k: string]: TranslationNode })[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
};

/**
 * Translate a dot-notation key to the given locale.
 * Falls back to English, then to the key itself (pass-through for
 * dynamic strings not in the locale files).
 */
export const t = (key: string, locale: string = DEFAULT_LOCALE): string => {
  if (locale !== DEFAULT_LOCALE) {
    const translated = lookup(resources[locale] ?? {}, key);
    if (translated) return translated;
  }
  return lookup(resources[DEFAULT_LOCALE], key) ?? key;
};

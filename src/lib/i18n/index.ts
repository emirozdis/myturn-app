import { useLanguageStore } from '../../store/useLanguageStore';
import { en } from './en';
import { tr } from './tr';
import { legacyEnglish } from './legacy';

export type Locale = 'en' | 'tr';
export const languages = { en, tr } as const;

function lookup(locale: Locale, key: string): string {
  const value = key.split('.').reduce<any>((current, part) => current?.[part], languages[locale]);
  if (typeof value === 'string') return value;
  const fallback = key.split('.').reduce<any>((current, part) => current?.[part], languages.en);
  return typeof fallback === 'string' ? fallback : key;
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>) {
  let value = lookup(locale, key);
  Object.entries(vars || {}).forEach(([name, replacement]) => {
    value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
  });
  return value;
}

export function translateLegacy(locale: Locale, value: string) {
  return locale === 'en' ? (legacyEnglish[value] || value) : value;
}

export function useTranslation() {
  const locale = useLanguageStore((state) => state.locale);
  return { locale, t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}

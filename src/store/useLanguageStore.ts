// ./src/store/useLanguageStore.ts
import { create } from 'zustand';
import { storage } from '../lib/storage';

export type Locale = 'en' | 'tr';

interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: storage.getString('myturn_lang') === 'en' ? 'en' : 'tr',
  setLocale: (locale: Locale) => {
    storage.set('myturn_lang', locale);
    set({ locale });
  },
}));

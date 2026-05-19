import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Language } from './language.type';
import { languageConfig } from './language.config';

interface LanguageState {
  activeLanguage: Language;
  availableLanguages: Language[];
}

const initialState: LanguageState = {
  activeLanguage: languageConfig.defaultLanguage,
  availableLanguages: [...languageConfig.availableLanguages],
};

export const LanguageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setActiveLanguage(language: Language): void {
      patchState(store, { activeLanguage: language });
    },
    setAvailableLanguages(languages: Language[]): void {
      patchState(store, { availableLanguages: languages });
    },
  })),
);

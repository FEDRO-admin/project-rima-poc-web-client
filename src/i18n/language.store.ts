import { withImmutableState } from '@angular-architects/ngrx-toolkit';
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { Language, languageConfig } from './language';

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
  withImmutableState<LanguageState>(() => initialState),
  withMethods((store) => ({
    setActiveLanguage(language: Language): void {
      patchState(store, { activeLanguage: language });
    },
    setAvailableLanguages(languages: Language[]): void {
      patchState(store, { availableLanguages: languages });
    },
  })),
);

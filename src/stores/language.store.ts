import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { TranslocoService } from '@jsverse/transloco';
import { Language } from '../i18n/language';
import { languageConfig } from '../i18n/language.config';

interface LanguageState {
  activeLanguage: Language;
}

const initialState: LanguageState = {
  activeLanguage: languageConfig.defaultLanguage,
};

export const LanguageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(() => ({
    availableLanguages: computed(() => languageConfig.availableLanguages),
  })),
  withMethods((store, translocoService = inject(TranslocoService)) => ({
    setLanguage(language: Language): void {
      translocoService.setActiveLang(language);
      patchState(store, { activeLanguage: language });
    },
  })),
);

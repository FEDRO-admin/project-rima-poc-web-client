import { provideTransloco } from '@jsverse/transloco';
import { isDevMode } from '@angular/core';
import { TranslocoHttpLoader } from './transloco/language.transloco.loader';
import { Language, languages } from './language.type';

interface LanguageConfig {
  availableLanguages: Language[];
  defaultLanguage: Language;
}

export const languageConfig = {
  availableLanguages: [...languages],
  defaultLanguage: 'de',
} as const satisfies LanguageConfig;

export function provideLanguage(): ReturnType<typeof provideTransloco> {
  return provideTransloco({
    config: {
      availableLangs: [...languageConfig.availableLanguages],
      defaultLang: languageConfig.defaultLanguage,
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
    },
    loader: TranslocoHttpLoader,
  });
}

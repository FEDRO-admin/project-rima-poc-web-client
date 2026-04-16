import { Language, languages } from './language';

interface LanguageConfig {
  availableLanguages: Language[];
  defaultLanguage: Language;
}

export const languageConfig = {
  availableLanguages: [...languages],
  defaultLanguage: 'de',
} as const satisfies LanguageConfig;

export const languages = ['de', 'fr', 'it'] as const;
export type Language = (typeof languages)[number];

interface LanguageConfig {
  availableLanguages: Language[];
  defaultLanguage: Language;
}

export const languageConfig = {
  availableLanguages: [...languages],
  defaultLanguage: 'de',
} as const satisfies LanguageConfig;

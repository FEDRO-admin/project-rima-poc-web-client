export const languages = ['de', 'fr', 'it'] as const;
export type Language = (typeof languages)[number];

export interface LanguageInfo {
  code: Language;
  catalogId: string;
}

export const languageInfos: LanguageInfo[] = [
  // { code: 'de', catalogId: 'DE (German)' },
  { code: 'de', catalogId: 'DE Sample' },
  { code: 'fr', catalogId: 'FR (French)' },
  { code: 'it', catalogId: 'IT (Italian)' },
];

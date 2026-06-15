import { Language } from './language';

export interface LanguageInfo {
  code: Language;
  catalogId: string;
}

export const languageInfos: LanguageInfo[] = [
  // { code: 'de', catalogId: 'DE (German)' },
  { code: 'de', catalogId: 'DE' },
  { code: 'fr', catalogId: 'FR' },
  { code: 'it', catalogId: 'IT' },
];

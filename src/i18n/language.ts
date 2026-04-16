export const languages = ['de', 'fr', 'it'] as const;
export type Language = (typeof languages)[number];

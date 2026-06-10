export const authModes = ['immediate', 'auto', 'manual', 'no-prompt'] as const;
export type AuthMode = (typeof authModes)[number];

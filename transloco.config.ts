import { TranslocoGlobalConfig } from '@jsverse/transloco-utils';

/**
 * Configuration for the Transloco Keys Manager CLI tool.
 *
 * This file is used by the `transloco-keys-manager` CLI (npm run i18n:extract)
 * to extract translation keys from the codebase and manage translation files.
 *
 * It cannot import runtime configuration from src/ because it runs in a
 * build-time context outside the Angular compilation system. Therefore,
 * languages are hardcoded here (duplicated from src/i18n/language.config.ts).
 *
 * The default export is consumed by the CLI tool, not by TypeScript imports.
 */
const config = {
  langs: ['de', 'fr', 'it'],
  keysManager: {
    input: ['src'],
    output: 'public/i18n',
  },
} as const satisfies TranslocoGlobalConfig;

export default config;

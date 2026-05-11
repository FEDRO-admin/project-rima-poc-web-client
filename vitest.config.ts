import { defineConfig } from 'vitest/config';

const isCI = process.env['GITHUB_ACTIONS'] === 'true';

export default defineConfig({
  test: {
    reporters: isCI ? ['dot', 'github-actions'] : ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});

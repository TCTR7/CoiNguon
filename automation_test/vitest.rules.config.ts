import { defineConfig } from 'vitest/config';
import { repoRoot } from './common_setup/paths.ts';
export default defineConfig({
  root: repoRoot,
  test: {
    environment: 'node',
    include: ['automation_test/features/**/tests/*.rules.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});

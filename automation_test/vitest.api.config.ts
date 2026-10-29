import { defineConfig } from 'vitest/config';
import { repoRoot } from './common_setup/paths.ts';
export default defineConfig({
  root: repoRoot,
  test: {
    environment: 'node',
    include: ['automation_test/features/**/tests/*.api.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});

import { defineConfig } from 'vitest/config';
import { repoRoot } from './common_setup/paths.ts';
export default defineConfig({
  root: repoRoot,
  test: {
    environment: 'node',
    include: ['backend/**/*.test.ts'],
    env: { APP_ENV: 'local', VITE_APP_ENV: 'local', VITE_FIREBASE_PROJECT_ID: 'demo-coinguon' },
  },
});

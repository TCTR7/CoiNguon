import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
let buildTarget = { mode: '', projectId: '' };
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'coinguon-build-target',
      configResolved(config) {
        const mode = String(config.env.VITE_APP_ENV || 'local');
        buildTarget = {
          mode,
          projectId: String(
            config.env.VITE_FIREBASE_PROJECT_ID || (mode === 'local' ? 'demo-coinguon' : ''),
          ),
        };
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'build-target.json',
          source: JSON.stringify(buildTarget),
        });
      },
    },
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: {
    env: {
      APP_ENV: 'local',
      VITE_APP_ENV: 'local',
      VITE_FIREBASE_PROJECT_ID: 'demo-coinguon',
      VITE_API_BASE_URL: 'http://127.0.0.1:8787/api',
    },
    environment: 'jsdom',
    setupFiles: './automation_test/common_setup/vitest.setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});

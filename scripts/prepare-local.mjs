import { build } from 'vite';
Object.assign(process.env, {
  APP_ENV: 'local',
  APP_ROLE: 'api',
  VITE_APP_ENV: 'local',
  VITE_FIREBASE_PROJECT_ID: 'demo-coinguon',
  VITE_API_BASE_URL: 'http://127.0.0.1:8787/api',
});
await build();
await import('./build-service-worker.mjs');

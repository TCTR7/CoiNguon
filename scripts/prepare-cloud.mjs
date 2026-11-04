import { build, loadEnv } from 'vite';
import { firebaseConfiguration } from '../src/shared/firebase/config.ts';
import { apiBaseUrl } from '../src/shared/firebase/api.ts';

const root = process.cwd();
const initial = loadEnv('production', root, 'VITE_');
const selected = process.env.VITE_APP_ENV || initial.VITE_APP_ENV;
const mode = selected === 'local' || !selected ? 'staging' : selected;
if (!['staging', 'production'].includes(mode))
  throw new Error(
    'Đặt VITE_APP_ENV=staging hoặc production trong .env.local trước khi build cloud.',
  );
const env = { ...loadEnv(mode, root, 'VITE_') };
for (const [name, value] of Object.entries(process.env))
  if (name.startsWith('VITE_') && value !== undefined) env[name] = value;
env.VITE_APP_ENV = mode;
process.env.VITE_APP_ENV = mode;
firebaseConfiguration(env);
apiBaseUrl(env);
await build({ root, mode });
await import('./build-service-worker.mjs');
console.log(
  `Cloud build ready: dist/; Firebase manifest: firebase.${mode}.json. No deployment performed.`,
);

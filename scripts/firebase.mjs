import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, DEBUG: '' }; // Avoid inherited DEBUG enabling verbose CLI/env output.
Object.assign(env, {
  APP_ENV: 'local',
  APP_ROLE: 'api',
  FIREBASE_PROJECT_ID: 'demo-coinguon',
  VITE_APP_ENV: 'local',
  VITE_FIREBASE_PROJECT_ID: 'demo-coinguon',
  VITE_API_BASE_URL: 'http://127.0.0.1:8787/api',
  PHONE_LOOKUP_HMAC_KEY: '',
});
delete env.K_SERVICE;
// Keep the inherited key casing: Windows may supply Path instead of PATH.
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const javaDir = path.join(root, '.tools/java');
if (existsSync(javaDir)) {
  const runtime = readdirSync(javaDir).find((name) =>
    existsSync(path.join(javaDir, name, 'bin/java.exe')),
  );
  if (runtime) {
    env.JAVA_HOME = path.join(javaDir, runtime);
    env[pathKey] = path.join(env.JAVA_HOME, 'bin') + path.delimiter + (env[pathKey] ?? '');
  }
}
const args = process.argv.slice(2);
if (!args.includes('auth')) {
  const version = spawnSync('java', ['-version'], { env, encoding: 'utf8' });
  const major = Number((version.stderr ?? '').match(/version "(\d+)/)?.[1]);
  if (!major || major < 21) {
    console.error(
      'Java 21+ is required. On Windows: powershell -File scripts/setup-java.ps1 (portable runtime).',
    );
    process.exit(1);
  }
}
const child = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
    ...args,
    '--project',
    'demo-coinguon',
  ],
  { cwd: root, env, stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

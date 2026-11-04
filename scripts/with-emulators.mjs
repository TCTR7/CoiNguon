import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv.slice(2).join(' ').trim();

if (!command) {
  console.error('Usage: node scripts/with-emulators.mjs "<command>"');
  process.exit(1);
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(800) });
    return response.status < 500;
  } catch {
    return false;
  }
}

const [authUp, firestoreUp] = await Promise.all([
  isReachable('http://127.0.0.1:9099/'),
  isReachable('http://127.0.0.1:8080/'),
]);

const child =
  authUp && firestoreUp
    ? spawn(command, { cwd: root, stdio: 'inherit', shell: true })
    : spawn(
        process.execPath,
        ['scripts/firebase.mjs', 'emulators:exec', '--only', 'auth,firestore', command],
        { cwd: root, stdio: 'inherit' },
      );

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on('exit', (code) => {
  process.exit(code ?? 1);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

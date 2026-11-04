import { spawn } from 'node:child_process';
const child = spawn(
  process.execPath,
  ['--env-file-if-exists=.env.local', '--experimental-strip-types', 'backend/server.ts'],
  { stdio: 'inherit' },
);
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--experimental-strip-types', 'backend/server.ts'], {
    stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function watch(child) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
watch(children[0]);
async function startFrontend() {
  const until = Date.now() + 15000;
  while (!stopping && Date.now() < until) {
    try {
      if ((await fetch('http://127.0.0.1:8787/health', { signal: AbortSignal.timeout(500) })).ok) {
        const frontend = spawn(
          process.execPath,
          [
            'node_modules/vite/bin/vite.js',
            'preview',
            '--host',
            '127.0.0.1',
            '--port',
            '5173',
            '--strictPort',
          ],
          { stdio: 'inherit' },
        );
        children.push(frontend);
        watch(frontend);
        return;
      }
    } catch {
      /* API may still be loading its modules. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!stopping) {
    console.error('Local API did not become ready.');
    stop(1);
  }
}
void startFrontend();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());

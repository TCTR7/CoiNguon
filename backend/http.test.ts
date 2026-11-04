// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { expect, it } from 'vitest';

async function checkServer(role: string, check: (base: string) => Promise<void>) {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const child: ChildProcess = spawn(
    process.execPath,
    ['--experimental-strip-types', 'backend/server.ts'],
    {
      env: {
        ...process.env,
        APP_ENV: 'staging',
        APP_ROLE: role,
        PORT: String(port),
        K_SERVICE: 'synthetic-service',
        FIREBASE_PROJECT_ID: 'synthetic-project',
        VITE_FIREBASE_PROJECT_ID: '',
        FIREBASE_AUTH_EMULATOR_HOST: '',
        FIRESTORE_EMULATOR_HOST: '',
        PHONE_LOOKUP_HMAC_KEY: 'ab'.repeat(32),
        ALLOWED_ORIGINS: 'https://synthetic-project.web.app',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('API startup timeout')), 15000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('API exited before ready'));
      });
      child.stdout!.once('data', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await check('http://127.0.0.1:' + port);
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}

it('serves cloud health and rejects untrusted origins and unauthenticated writes without accessing Firebase', async () => {
  await checkServer('api', async (base) => {
    const health = await fetch(base + '/api/health');
    expect(await health.json()).toEqual({
      mode: 'staging',
      projectId: 'synthetic-project',
      role: 'api',
    });
    expect(
      (await fetch(base + '/api/health', { headers: { Origin: 'https://evil.test' } })).status,
    ).toBe(403);
    expect(
      (
        await fetch(base + '/api/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(401);
    expect((await fetch(base + '/internal/reminders/tick', { method: 'POST' })).status).toBe(404);
  });
}, 20000);

it('isolates the worker from user APIs and rejects injected clocks', async () => {
  await checkServer('worker', async (base) => {
    expect((await fetch(base + '/api/account', { method: 'POST' })).status).toBe(404);
    expect(
      (
        await fetch(base + '/internal/reminders/tick', {
          method: 'POST',
          body: JSON.stringify({ now: 0 }),
        })
      ).status,
    ).toBe(400);
  });
}, 20000);

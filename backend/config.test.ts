// @vitest-environment node
import { expect, it } from 'vitest';
import { backendConfiguration } from './config';

const cloud = {
  APP_ENV: 'staging',
  FIREBASE_PROJECT_ID: 'synthetic-project',
  PHONE_LOOKUP_HMAC_KEY: 'ab'.repeat(32),
};
it('defaults to isolated local emulators, not cloud credentials', () => {
  expect(backendConfiguration({})).toMatchObject({
    local: true,
    projectId: 'demo-coinguon',
    host: '127.0.0.1',
    port: 8787,
  });
});
it('uses cloud project, managed secret and platform port', () => {
  expect(backendConfiguration({ ...cloud, PORT: '9090', K_SERVICE: 'test-api' })).toMatchObject({
    local: false,
    projectId: 'synthetic-project',
    port: 9090,
    host: '0.0.0.0',
    role: 'api',
  });
});
it.each([
  { FIREBASE_PROJECT_ID: '' },
  { FIREBASE_PROJECT_ID: 'demo-coinguon' },
  { VITE_FIREBASE_PROJECT_ID: 'another-project' },
  { PHONE_LOOKUP_HMAC_KEY: '' },
  { PHONE_LOOKUP_HMAC_KEY: 'invalid' },
  { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
  { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
  { APP_ENV: 'typo' },
  { PORT: '0' },
  { PORT: '65536' },
  { APP_ROLE: 'unknown' },
  { ALLOWED_ORIGINS: 'https://example.test/path' },
  { ALLOWED_ORIGINS: 'http://example.test' },
])('fails closed on invalid cloud configuration %j', (override) => {
  expect(() => backendConfiguration({ ...cloud, ...override })).toThrow();
});
it('does not let a Cloud Run service fall back to local mode', () => {
  expect(() => backendConfiguration({ K_SERVICE: 'cloud-api' })).toThrow('APP_ENV');
});
it('only permits explicit loopback HTTP for staging development', () => {
  expect(
    backendConfiguration({ ...cloud, ALLOWED_ORIGINS: 'http://127.0.0.1:5173' }).origins,
  ).toEqual(['http://127.0.0.1:5173']);
  expect(() =>
    backendConfiguration({
      ...cloud,
      APP_ENV: 'production',
      ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    }),
  ).toThrow();
});

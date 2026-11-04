import { expect, it } from 'vitest';
import { firebaseConfiguration } from './config';

const cloud = {
  VITE_APP_ENV: 'staging',
  VITE_FIREBASE_API_KEY: 'synthetic-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'synthetic-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'synthetic-project',
  VITE_FIREBASE_APP_ID: 'synthetic-app',
};

it('keeps unconfigured local runs on the demo emulators', () => {
  expect(firebaseConfiguration({})).toMatchObject({
    useEmulators: true,
    options: { projectId: 'demo-coinguon' },
  });
});

it.each(['staging', 'production'])(
  'uses supplied Firebase values in %s without emulators',
  (mode) => {
    expect(firebaseConfiguration({ ...cloud, VITE_APP_ENV: mode })).toEqual({
      useEmulators: false,
      options: {
        apiKey: cloud.VITE_FIREBASE_API_KEY,
        authDomain: cloud.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: cloud.VITE_FIREBASE_PROJECT_ID,
        appId: cloud.VITE_FIREBASE_APP_ID,
      },
    });
  },
);

it.each([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
])('rejects a missing cloud %s instead of falling back to local', (name) => {
  expect(() => firebaseConfiguration({ ...cloud, [name]: '  ' })).toThrow(name);
});

it('rejects unknown modes, cloud demo projects and real projects in local mode', () => {
  expect(() => firebaseConfiguration({ ...cloud, VITE_APP_ENV: 'typo' })).toThrow('VITE_APP_ENV');
  expect(() =>
    firebaseConfiguration({ ...cloud, VITE_FIREBASE_PROJECT_ID: 'demo-coinguon' }),
  ).toThrow('demo');
  expect(() => firebaseConfiguration({ ...cloud, VITE_APP_ENV: 'local' })).toThrow('VITE_APP_ENV');
});

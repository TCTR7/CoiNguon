import { expect, it } from 'vitest';
import { apiBaseUrl } from './api';

it('uses local API for local mode and same-origin API in cloud', () => {
  expect(apiBaseUrl({})).toBe('http://127.0.0.1:8787/api');
  expect(apiBaseUrl({ VITE_APP_ENV: 'staging' })).toBe('/api');
  expect(
    apiBaseUrl({ VITE_APP_ENV: 'production', VITE_API_BASE_URL: 'https://api.example.test/api/' }),
  ).toBe('https://api.example.test/api');
});
it.each([
  'http://api.example.test/api',
  'https://localhost/api',
  'https://127.0.0.1/api',
  '//evil.test/api',
  'https://user:secret@api.example.test/api',
  'https://api.example.test/api?token=x',
])('rejects unsafe cloud API URL %s', (base) => {
  expect(() => apiBaseUrl({ VITE_APP_ENV: 'production', VITE_API_BASE_URL: base })).toThrow();
});

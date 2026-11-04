export function apiBaseUrl(env: Record<string, unknown>) {
  const local = !env.VITE_APP_ENV || env.VITE_APP_ENV === 'local';
  const base = String(
    env.VITE_API_BASE_URL || (local ? 'http://127.0.0.1:8787/api' : '/api'),
  ).replace(/\/$/, '');
  if (base === '/api') return base;
  const url = new URL(base);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/api' ||
    (!local &&
      (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) ||
    (local && !['http:', 'https:'].includes(url.protocol))
  )
    throw new Error('VITE_API_BASE_URL phải là /api hoặc HTTPS API hợp lệ.');
  return base;
}

export function apiUrl(path: string) {
  return apiBaseUrl(import.meta.env) + '/' + path;
}

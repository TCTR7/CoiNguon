export function backendConfiguration(env: NodeJS.ProcessEnv) {
  const mode = env.APP_ENV || env.VITE_APP_ENV || 'local';
  if (!['local', 'staging', 'production'].includes(mode))
    throw new Error('APP_ENV phải là local, staging hoặc production.');
  const local = mode === 'local';
  if (local && env.K_SERVICE) throw new Error('Cloud Run cần APP_ENV=staging hoặc production.');
  const projectId = local
    ? 'demo-coinguon'
    : env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '';
  if (
    !local &&
    (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || projectId.startsWith('demo-'))
  )
    throw new Error('Cần FIREBASE_PROJECT_ID của project Firebase thật.');
  if (!local && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_PROJECT_ID !== projectId)
    throw new Error('Frontend và backend phải dùng cùng Firebase project.');
  if (!local && (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST))
    throw new Error('Chế độ cloud không được kết nối Emulator.');
  const role = env.APP_ROLE || 'api';
  if (!['api', 'worker'].includes(role)) throw new Error('APP_ROLE phải là api hoặc worker.');
  const phoneKey = env.PHONE_LOOKUP_HMAC_KEY || '';
  if (!local && !/^[a-f0-9]{64}$/i.test(phoneKey))
    throw new Error('Cần PHONE_LOOKUP_HMAC_KEY gồm 64 ký tự hex từ Secret Manager.');
  const port = Number(env.PORT || (local ? 8787 : 8080));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ.');
  const origins = (
    env.ALLOWED_ORIGINS ||
    (local
      ? 'http://127.0.0.1:5173,http://localhost:5173'
      : `https://${projectId}.web.app,https://${projectId}.firebaseapp.com`)
  )
    .split(',')
    .map((value) => value.trim());
  for (const origin of origins) {
    const url = new URL(origin);
    const loopback =
      mode === 'staging' &&
      ['localhost', '127.0.0.1'].includes(url.hostname) &&
      url.protocol === 'http:';
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      (!local && !loopback && url.protocol !== 'https:')
    )
      throw new Error('ALLOWED_ORIGINS phải là các HTTPS origin, phân cách bằng dấu phẩy.');
  }
  return {
    mode,
    local,
    projectId,
    role,
    phoneKey,
    port,
    origins,
    host: local ? '127.0.0.1' : '0.0.0.0',
  };
}

export const runtime = backendConfiguration(process.env);

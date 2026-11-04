import type { FirebaseOptions } from 'firebase/app';

export function firebaseConfiguration(env: Record<string, unknown>): {
  options: FirebaseOptions;
  useEmulators: boolean;
} {
  const mode = String(env.VITE_APP_ENV ?? '').trim() || 'local';
  if (!['local', 'staging', 'production'].includes(mode))
    throw new Error('VITE_APP_ENV phải là local, staging hoặc production.');

  if (mode === 'local') {
    const projectId = String(env.VITE_FIREBASE_PROJECT_ID ?? '').trim();
    if (projectId && projectId !== 'demo-coinguon')
      throw new Error('Đặt VITE_APP_ENV=staging hoặc production để dùng Firebase thật.');
    return {
      useEmulators: true,
      options: {
        apiKey: 'demo-key',
        authDomain: 'demo-coinguon.firebaseapp.com',
        projectId: 'demo-coinguon',
      },
    };
  }

  const required = (name: string) => {
    const value = typeof env[name] === 'string' ? env[name].trim() : '';
    if (!value) throw new Error('Thiếu biến môi trường ' + name + '.');
    return value;
  };
  const options = {
    apiKey: required('VITE_FIREBASE_API_KEY'),
    authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: required('VITE_FIREBASE_PROJECT_ID'),
    appId: required('VITE_FIREBASE_APP_ID'),
  };
  if (options.projectId.startsWith('demo-'))
    throw new Error('Firebase thật không được dùng project demo.');
  return { options, useEmulators: false };
}

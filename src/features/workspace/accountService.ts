import { apiUrl } from '../../shared/firebase/api';
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  setPersistence,
  browserSessionPersistence,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../../shared/firebase/client';
import { requireOnline } from './service';
export interface Account {
  displayName: string;
  phone: string;
  version: number;
}
export async function workspaceApi(
  path: 'account' | 'phone-invites' | 'join',
  body: Record<string, unknown>,
) {
  requireOnline();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập.');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (await user.getIdToken()),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Chưa thực hiện được.');
    if (auth.currentUser?.uid !== user.uid) throw new Error('Tài khoản đã thay đổi. Hãy tải lại.');
    return data;
  } catch (error) {
    if (error instanceof TypeError || (error as Error).name === 'AbortError')
      throw new Error('Chưa kết nối được dịch vụ. Kiểm tra kết nối rồi thử lại.');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
export async function googleLogin() {
  requireOnline();
  await setPersistence(auth, browserSessionPersistence);
  await signInWithPopup(auth, new GoogleAuthProvider());
}
export async function googleReauthenticate() {
  requireOnline();
  if (!auth.currentUser) throw new Error('Vui lòng đăng nhập.');
  await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
}

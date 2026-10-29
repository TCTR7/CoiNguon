import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../shared/firebase/client';
import { requireOnline } from '../workspace/service';
export interface JoinPreview {
  linkVersion: number;
  clanId: string;
  clanName: string;
  expiresAtMs: number;
}
export interface JoinSettings {
  token: string;
  version: number;
  revoked: boolean;
  expiresAtMs: number;
}
export interface JoinRequest {
  id: string;
  clanId: string;
  clanName: string;
  uid: string;
  displayName: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  version: number;
  linkHash: string;
  linkExpiresAtMs: number;
  linkVersion: number;
}
export const requestLabels: Record<JoinRequest['status'], string> = {
  pending: 'Đang chờ quản trị viên duyệt',
  approved: 'Đã được duyệt',
  rejected: 'Chưa được chấp nhận',
  cancelled: 'Đã rút yêu cầu',
};
async function api(payload: Record<string, unknown>, preview = false) {
  requireOnline();
  const user = auth.currentUser;
  if (!preview && !user) throw new Error('Vui lòng đăng nhập trước khi đăng ký tham gia.');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('http://127.0.0.1:8787/api/join' + (preview ? '/preview' : ''), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(!preview ? { Authorization: 'Bearer ' + (await user!.getIdToken()) } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Chưa thực hiện được. Hãy thử lại.');
    return body;
  } catch (e) {
    if (e instanceof TypeError || (e as Error).name === 'AbortError')
      throw new Error('Chưa kết nối được dịch vụ local. Kiểm tra kết nối rồi thử lại.');
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}
export const previewJoin = (token: string): Promise<JoinPreview> => api({ token }, true);
export const joinMutation = (
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ status: string; clanId?: string }> => api({ action, ...payload });
export function watchJoinRequests(
  filter: 'uid' | 'clanId',
  value: string,
  onData: (data: JoinRequest[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'joinRequests'), where(filter, '==', value)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache)
        onData(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as JoinRequest));
    },
    onError,
  );
}
export function watchJoinSettings(
  clanId: string,
  onData: (data: JoinSettings | null) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    doc(db, 'clans', clanId, 'joinSettings', 'current'),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache)
        onData(snapshot.exists() ? (snapshot.data() as JoinSettings) : null);
    },
    onError,
  );
}

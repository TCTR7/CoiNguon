import { apiUrl } from '../../shared/firebase/api';
import { clearPrivateData, pruneSnapshots } from '../../shared/offline/store';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { auth, db, useFirebaseEmulators } from '../../shared/firebase/client';
export type Role = 'admin' | 'editor' | 'member';
export const roleLabels: Record<Role, string> = {
  admin: 'Quản trị viên',
  editor: 'Biên tập viên',
  member: 'Thành viên',
};
export interface Membership {
  id: string;
  clanId: string;
  uid: string;
  displayName: string;
  role: Role;
  invitationId: string | null;
  managementVersion?: number;
  joinedAt?: Timestamp;
}
export interface Clan {
  id: string;
  name: string;
  ownerUid: string;
}
export interface Invitation {
  id: string;
  clanId: string;
  clanName: string;
  role: 'editor' | 'member';
  revoked: boolean;
  acceptedBy: string | null;
  expiresAt: Timestamp;
  createdBy: string;
}
export function requireOnline() {
  if (!navigator.onLine)
    throw new Error('Đang ngoại tuyến. Vui lòng kết nối mạng trước khi thay đổi dữ liệu.');
}
function validName(name: string) {
  const value = name.trim();
  if (value.length < 2 || value.length > 80) throw new Error('Tên cần có từ 2 đến 80 ký tự.');
  return value;
}
export async function login(email: string, password: string, name?: string) {
  requireOnline();
  if (!useFirebaseEmulators) throw new Error('Vui lòng đăng nhập bằng Google.');
  if (!/^[^@\s]+@[^@\s]+\.test$/i.test(email.trim()))
    throw new Error('Dùng email giả kết thúc bằng .test, ví dụ khoi@gia-dinh.test.');
  if (password.length < 8) throw new Error('Mật khẩu thử cần ít nhất 8 ký tự.');
  await setPersistence(auth, browserSessionPersistence);
  if (name !== undefined) {
    const displayName = validName(name);
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(result.user, { displayName });
    await result.user.getIdToken(true);
    return;
  }
  await signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function logout() {
  await clearPrivateData();
  await signOut(auth);
}
export function watchMine(
  uid: string,
  onData: (members: Membership[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'memberships'), where('uid', '==', uid)),
    { includeMetadataChanges: true },
    (s) => {
      if (!s.metadata.fromCache) {
        const members = s.docs.map((d) => ({ ...d.data(), id: d.id }) as Membership);
        void pruneSnapshots(uid, members).catch(() => undefined);
        onData(members);
      }
    },
    onError,
  );
}
export function watchMembers(
  clanId: string,
  onData: (members: Membership[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'memberships'), where('clanId', '==', clanId)),
    { includeMetadataChanges: true },
    (s) => {
      if (!s.metadata.fromCache)
        onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Membership));
    },
    onError,
  );
}
export function watchInvitations(
  clanId: string,
  onData: (invites: Invitation[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'invitations'), where('clanId', '==', clanId)),
    { includeMetadataChanges: true },
    (s) => {
      if (!s.metadata.fromCache)
        onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Invitation));
    },
    onError,
  );
}
export async function getClan(id: string): Promise<Clan> {
  const snapshot = await getDocFromServer(doc(db, 'clans', id));
  if (!snapshot.exists()) throw new Error('Không tìm thấy dòng họ.');
  return { ...snapshot.data(), id } as Clan;
}
export async function createClan(name: string) {
  requireOnline();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập.');
  const displayName = validName(user.displayName || 'Thành viên mới');
  const clan = doc(collection(db, 'clans'));
  await runTransaction(db, async (transaction) => {
    transaction.set(clan, {
      name: validName(name),
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
    });
    transaction.set(doc(db, 'memberships', clan.id + '_' + user.uid), {
      clanId: clan.id,
      uid: user.uid,
      displayName,
      role: 'admin',
      joinedAt: serverTimestamp(),
      invitationId: null,
    });
  });
  return clan.id;
}
export async function createInvitation(clan: Clan, role: 'editor' | 'member') {
  requireOnline();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập.');
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await runTransaction(db, async (transaction) => {
    transaction.set(doc(db, 'invitations', token), {
      clanId: clan.id,
      clanName: clan.name,
      role,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 6 * 24 * 60 * 60 * 1000),
      revoked: false,
      acceptedBy: null,
    });
  });
  return token;
}
export async function getInvitation(token: string): Promise<Invitation> {
  requireOnline();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Mã mời không hợp lệ.');
  const snapshot = await getDocFromServer(doc(db, 'invitations', token));
  if (!snapshot.exists()) throw new Error('Không tìm thấy lời mời.');
  return { ...snapshot.data(), id: token } as Invitation;
}
export async function acceptInvitation(token: string) {
  requireOnline();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập.');
  const { workspaceApi } = await import('./accountService');
  const result = await workspaceApi('join', { action: 'submitPrivate', token });
  return result.clanId as string;
}
export async function revokeInvitation(id: string) {
  requireOnline();
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'invitations', id);
    await transaction.get(ref);
    transaction.update(ref, { revoked: true });
  });
}
async function membershipMutation(
  member: Membership,
  action: 'changeRole' | 'remove' | 'leave',
  role?: Role,
) {
  requireOnline();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập.');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(apiUrl('memberships'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (await user.getIdToken()),
      },
      body: JSON.stringify({
        action,
        clanId: member.clanId,
        uid: member.uid,
        role,
        expectedRole: member.role,
        version: member.managementVersion ?? 0,
        epoch: [
          member.joinedAt?.seconds ?? 0,
          member.joinedAt?.nanoseconds ?? 0,
          member.invitationId ?? '',
        ].join(':'),
      }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Chưa cập nhật được thành viên.');
  } catch (e) {
    if (e instanceof TypeError || (e as Error).name === 'AbortError')
      throw new Error('Chưa kết nối được dịch vụ. Kiểm tra kết nối rồi tải lại trước khi thử lại.');
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}
export async function changeRole(member: Membership, role: Role) {
  await membershipMutation(member, 'changeRole', role);
}
export async function removeMember(member: Membership) {
  await membershipMutation(member, member.uid === auth.currentUser?.uid ? 'leave' : 'remove');
}
export function friendlyError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request')
    return 'Bạn đã đóng đăng nhập Google. Có thể thử lại khi sẵn sàng.';
  if (code === 'auth/popup-blocked')
    return 'Trình duyệt đang chặn cửa sổ đăng nhập. Hãy cho phép popup hoặc mở bằng trình duyệt hệ thống.';
  if (code === 'auth/user-mismatch')
    return 'Hãy chọn đúng tài khoản Google đang đăng nhập để xác nhận đổi số.';
  if (code === 'permission-denied')
    return 'Bạn không còn quyền thực hiện thao tác này hoặc lời mời không còn hiệu lực. Hãy tải lại dữ liệu.';
  if (code === 'auth/email-already-in-use')
    return 'Email thử này đã có tài khoản. Hãy chọn Đăng nhập.';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  )
    return 'Email hoặc mật khẩu chưa đúng.';
  if (code === 'auth/network-request-failed' || code === 'unavailable')
    return 'Chưa kết nối được môi trường thử. Hãy khởi động npm run emulators và thử lại.';
  return error instanceof Error ? error.message : 'Chưa thực hiện được. Vui lòng thử lại.';
}

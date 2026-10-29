import { auth } from '../../shared/firebase/client';
import { invitationRequest } from '../invitations/api';
export async function accountRequest<T>(
  path: 'data' | 'reminders',
  clanId: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!navigator.onLine)
    throw new Error('Đang ngoại tuyến. Thao tác này không được xếp hàng để gửi sau.');
  if (!auth.currentUser) throw new Error('Vui lòng đăng nhập.');
  return invitationRequest<T>(
    path,
    { clanId, action, ...payload },
    await auth.currentUser.getIdToken(),
  );
}

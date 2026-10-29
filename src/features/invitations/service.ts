import { auth } from '../../shared/firebase/client';
import { requireOnline } from '../workspace/service';
import { invitationRequest } from './api';
import type { InvitationDashboard } from './types';
export async function invitationMutation<T = { status: string; id?: string }>(
  clanId: string,
  eventId: string,
  action: string,
  payload: Record<string, unknown> = {},
) {
  requireOnline();
  if (!auth.currentUser) throw new Error('Vui lòng đăng nhập.');
  return invitationRequest<T>(
    'invitations',
    { clanId, eventId, action, ...payload },
    await auth.currentUser.getIdToken(),
  );
}
export const loadInvitationDashboard = (clanId: string, eventId: string) =>
  invitationMutation<InvitationDashboard>(clanId, eventId, 'dashboard');
export const invitationLink = (token: string) => window.location.origin + '/loi-moi#' + token;

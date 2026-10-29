import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../shared/firebase/client';
import { requireOnline } from '../workspace/service';
import type {
  FamilyPerson,
  FamilyRelationship,
  PersonLink,
  PersonRequest,
} from '../../shared/domain/genealogy';
export interface GenealogyData {
  people: FamilyPerson[];
  relationships: FamilyRelationship[];
  requests: PersonRequest[];
  links: PersonLink[];
}
export class GenealogyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function genealogyMutation(
  clanId: string,
  action: string,
  payload: Record<string, unknown> = {},
) {
  requireOnline();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập.');
  let response: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  try {
    response = await fetch('http://127.0.0.1:8787/api/genealogy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (await user.getIdToken()),
      },
      body: JSON.stringify({ clanId, action, ...payload }),
      signal: controller.signal,
    });
  } catch {
    throw new Error('Chưa kết nối được dịch vụ gia phả local. Kiểm tra npm run dev rồi thử lại.');
  } finally {
    window.clearTimeout(timeout);
  }
  const result = await response.json();
  if (!response.ok)
    throw new GenealogyError(response.status, result.error || 'Không thực hiện được thao tác.');
  return result as { id: string; version?: number };
}
export function watchGenealogy(
  clanId: string,
  uid: string,
  admin: boolean,
  onData: (data: GenealogyData) => void,
  onError: (error: Error, collectionName: string) => void,
) {
  const state: GenealogyData = { people: [], relationships: [], requests: [], links: [] };
  const loaded = new Set<string>();
  const subscribe = (collectionName: string, key: keyof GenealogyData, own = false) => {
    const ref = collection(db, 'clans', clanId, collectionName);
    return onSnapshot(
      own ? query(ref, where('uid', '==', uid)) : ref,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) return;
        Object.assign(state, { [key]: snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) });
        loaded.add(key);
        if (loaded.size === 4) onData({ ...state });
      },
      (error) => onError(error, collectionName),
    );
  };
  const unsubscribers = [
    subscribe('people', 'people'),
    subscribe('relationships', 'relationships'),
    subscribe('personLinks', 'links'),
    subscribe('personRequests', 'requests', !admin),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

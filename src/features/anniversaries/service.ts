import { apiUrl } from '../../shared/firebase/api';
import { collection } from 'firebase/firestore';
import { watchPagedCollection } from '../../shared/firebase/watchPagedCollection';
import { auth, db } from '../../shared/firebase/client';
import { requireOnline } from '../workspace/service';
import type { FamilyPerson } from '../../shared/domain/genealogy';
import type {
  AnniversaryRule,
  HostAssignment,
  MemorialEvent,
  Delegation,
} from '../../shared/domain/anniversary';

export interface CalendarData {
  people: FamilyPerson[];
  rules: AnniversaryRule[];
  assignments: HostAssignment[];
  events: MemorialEvent[];
  delegations: Delegation[];
}
export async function eventMutation(
  clanId: string,
  action: string,
  payload: Record<string, unknown> = {},
) {
  requireOnline();
  if (!auth.currentUser) throw new Error('Vui lòng đăng nhập.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(apiUrl('events'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (await auth.currentUser.getIdToken()),
      },
      body: JSON.stringify({ clanId, action, ...payload }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Chưa thực hiện được thao tác.');
    return result as { id: string; notice?: string };
  } catch (e) {
    if (e instanceof TypeError || (e as Error).name === 'AbortError')
      throw new Error(
        'Chưa kết nối được lịch giỗ. Kiểm tra kết nối; tải bản mới trước khi thử lại.',
      );
    throw e;
  } finally {
    window.clearTimeout(timeout);
  }
}
export function watchCalendar(
  clanId: string,
  onData: (data: CalendarData) => void,
  onError: (e: Error) => void,
) {
  const state: CalendarData = {
    people: [],
    rules: [],
    assignments: [],
    events: [],
    delegations: [],
  };
  const loaded = new Set<string>();
  let invalidated = false;
  const pairs = [
    ['people', 'people'],
    ['anniversaryRules', 'rules'],
    ['assignments', 'assignments'],
    ['events', 'events'],
    ['delegations', 'delegations'],
  ] as const;
  const unsub = pairs.map(([name, key]) =>
    watchPagedCollection(
      collection(db, 'clans', clanId, name),
      (rows) => {
        if (invalidated) return;
        Object.assign(state, { [key]: rows });
        loaded.add(key);
        if (loaded.size === pairs.length) onData({ ...state });
      },
      (error) => {
        invalidated = true;
        onError(error);
      },
    ),
  );
  return () => unsub.forEach((fn) => fn());
}

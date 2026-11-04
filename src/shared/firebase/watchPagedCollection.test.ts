import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  listeners: [] as {
    constraints: { start?: string; end?: string; limit?: number }[];
    next: (snapshot: unknown) => void;
    error: (error: Error) => void;
    active: boolean;
    emitted: boolean;
  }[],
  rows: new Map<string, string>(),
  sizes: [] as number[],
}));
vi.mock('firebase/firestore', () => ({
  documentId: () => '__name__',
  orderBy: () => ({}),
  startAfter: (start: string) => ({ start }),
  endAt: (end: string) => ({ end }),
  limit: (limit: number) => ({ limit }),
  query: (source: { constraints: object[] }, ...constraints: object[]) => ({
    constraints: [...source.constraints, ...constraints],
  }),
  onSnapshot: (
    source: { constraints: object[] },
    _options: unknown,
    next: (snapshot: unknown) => void,
    error: (error: Error) => void,
  ) => {
    const listener = { constraints: source.constraints, next, error, active: true, emitted: false };
    state.listeners.push(listener);
    return () => {
      listener.active = false;
    };
  },
}));
import { watchPagedCollection } from './watchPagedCollection';
import type { Query, DocumentData } from 'firebase/firestore';
const source = { constraints: [] } as unknown as Query<DocumentData>;
const emit = (listener: (typeof state.listeners)[number], fromCache = false) => {
  const start = listener.constraints.find((c) => c.start)?.start,
    end = listener.constraints.find((c) => c.end)?.end,
    size = listener.constraints.find((c) => c.limit)?.limit ?? Infinity;
  const docs = [...state.rows]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([id]) => (!start || id > start) && (!end || id <= end))
    .slice(0, size)
    .map(([id, name]) => ({ id, data: () => ({ name }) }));
  state.sizes.push(docs.length);
  listener.emitted = true;
  listener.next({ docs, metadata: { fromCache }, docChanges: () => [{}] });
};
const flush = () => {
  for (let i = 0; i < state.listeners.length; i++) {
    const listener = state.listeners[i];
    if (listener.active && !listener.emitted) emit(listener);
  }
};
beforeEach(() => {
  state.listeners.length = 0;
  state.rows.clear();
  state.sizes.length = 0;
});
it('loads all records through bounded disjoint intervals and splits live inserts without gaps', () => {
  for (let i = 0; i < 27; i++) state.rows.set(String(i * 2).padStart(3, '0'), 'Người ' + i);
  const data = vi.fn(),
    error = vi.fn();
  const stop = watchPagedCollection<{ id: string; name: string }>(source, data, error, 4);
  flush();
  expect(data.mock.lastCall?.[0]).toHaveLength(27);
  expect(Math.max(...state.sizes)).toBeLessThanOrEqual(5);
  for (let i = 1; i < 8; i += 2) state.rows.set(String(i).padStart(3, '0'), 'Người mới');
  state.rows.delete('006'); // Remove a page boundary; its ID interval still covers future inserts.
  for (const listener of [...state.listeners]) if (listener.active) emit(listener);
  flush();
  const rows = data.mock.lastCall?.[0] as { id: string }[];
  expect(rows.map((r) => r.id).sort()).toEqual([...state.rows.keys()].sort());
  expect(new Set(rows.map((r) => r.id)).size).toBe(state.rows.size);
  stop();
  expect(state.listeners.every((l) => !l.active)).toBe(true);
  expect(error).not.toHaveBeenCalled();
});
it('waits for server data and ignores stale pages after cancellation or lost access', () => {
  state.rows.set('a', 'Dữ liệu giả');
  const data = vi.fn(),
    error = vi.fn();
  const stop = watchPagedCollection(source, data, error, 3);
  emit(state.listeners[0], true);
  expect(data).not.toHaveBeenCalled();
  emit(state.listeners[0]);
  expect(data).toHaveBeenCalledTimes(1);
  const denied = new Error('permission denied');
  state.listeners[0].error(denied);
  emit(state.listeners[0]);
  expect(error).toHaveBeenCalledWith(denied);
  expect(data).toHaveBeenCalledTimes(1);
  expect(state.listeners[0].active).toBe(false);
  stop();
});
it('cancels loading before starting deferred intervals', () => {
  for (let i = 0; i < 10; i++) state.rows.set(String(i), 'Người giả');
  const data = vi.fn();
  const stop = watchPagedCollection(source, data, vi.fn(), 2);
  emit(state.listeners[0]);
  stop();
  flush();
  expect(data).not.toHaveBeenCalled();
  expect(state.listeners.every((l) => !l.active)).toBe(true);
});

it('reconciles cached changes when the server confirmation carries only metadata', () => {
  state.rows.set('a', 'Tên cũ');
  const data = vi.fn();
  watchPagedCollection(source, data, vi.fn(), 3);
  flush();
  state.listeners[0].next({
    docs: [{ id: 'b', data: () => ({ name: 'Tên mới' }) }],
    metadata: { fromCache: true },
    docChanges: () => [{}],
  });
  state.listeners[0].next({
    docs: [{ id: 'b', data: () => ({ name: 'Tên mới' }) }],
    metadata: { fromCache: false },
    docChanges: () => [],
  });
  expect(data.mock.lastCall?.[0]).toEqual([{ id: 'b', name: 'Tên mới' }]);
});

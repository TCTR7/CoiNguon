import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  listeners: [] as {
    next: (rows: unknown[]) => void;
    error: (error: Error) => void;
    stop: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => args,
  query: (...args: unknown[]) => args,
  where: vi.fn(),
}));
vi.mock('../../shared/firebase/client', () => ({ auth: {}, db: {} }));
vi.mock('../workspace/service', () => ({ requireOnline: vi.fn() }));
vi.mock('../../shared/firebase/watchPagedCollection', () => ({
  watchPagedCollection: (
    _source: unknown,
    next: (rows: unknown[]) => void,
    error: (error: Error) => void,
  ) => {
    const stop = vi.fn();
    mocks.listeners.push({ next, error, stop });
    return stop;
  },
}));
import { watchGenealogy } from './service';
beforeEach(() => {
  mocks.listeners.length = 0;
});
it('publishes only when every collection has loaded and unsubscribes all readers', () => {
  const data = vi.fn();
  const stop = watchGenealogy('synthetic', 'user', true, data, vi.fn());
  for (const listener of mocks.listeners.slice(0, 3)) listener.next([]);
  expect(data).not.toHaveBeenCalled();
  mocks.listeners[3].next([]);
  mocks.listeners[0].next([{ id: 'a', name: 'Người giả' }]);
  expect(data.mock.lastCall?.[0].people).toEqual([{ id: 'a', name: 'Người giả' }]);
  stop();
  expect(mocks.listeners.every((l) => l.stop.mock.calls.length === 1)).toBe(true);
});
it('does not republish private snapshots after any reader loses access', () => {
  const data = vi.fn(),
    error = vi.fn();
  watchGenealogy('synthetic', 'user', false, data, error);
  for (const listener of mocks.listeners) listener.next([]);
  const denied = new Error('permission denied');
  mocks.listeners[0].error(denied);
  mocks.listeners[1].next([{ id: 'private' }]);
  expect(data).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(denied, 'people');
});

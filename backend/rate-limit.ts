import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { store, ApiError } from './service.ts';
import { runtime } from './config.ts';

// Shared fixed-window counters. Only hashes are stored; TTL expires old windows.
export async function consumeBudget(key: string, limit: number) {
  if (runtime.local) return;
  return consumeSharedBudget(key, limit);
}

export async function consumeSharedBudget(key: string, limit: number, now = Date.now()) {
  const minute = Math.floor(now / 60000);
  const hash = createHash('sha256').update(key).digest('hex');
  const ref = store.doc(`requestBudgets/${hash}_${minute}`);
  await store.runTransaction(async (tx) => {
    const count = (await tx.get(ref)).data()?.count || 0;
    if (count >= limit) throw new ApiError(429, 'Bạn thao tác quá nhanh. Thử lại sau một phút.');
    tx.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis((minute + 2) * 60000) });
  });
}

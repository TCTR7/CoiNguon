import { expect, it } from 'vitest';
import { consumeSharedBudget } from '../../../../backend/rate-limit';

it('enforces a shared budget atomically across simultaneous requests and resets next minute', async () => {
  const key = 'synthetic-budget:' + crypto.randomUUID();
  const now = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () => consumeSharedBudget(key, 3, now)),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
  const rejected = results.find((result) => result.status === 'rejected');
  expect(rejected?.status === 'rejected' && rejected.reason.status).toBe(429);
  await expect(consumeSharedBudget(key, 3, now + 60000)).resolves.toBeUndefined();
});

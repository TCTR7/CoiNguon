import { expect, it } from 'vitest';
import { normalizePhone } from './phone';
it('normalizes Vietnamese mobile formats to one identity', () => {
  for (const input of ['0901234567', '+84901234567', '090 123 4567', '(090)123-4567'])
    expect(normalizePhone(input)).toBe('+84901234567');
});
it('rejects foreign, landline, incomplete and non-numeric claims', () => {
  for (const input of [
    '+12025550123',
    '0241234567',
    '090123',
    '09012345678',
    '090123456x',
    null,
    901234567,
  ])
    expect(() => normalizePhone(input)).toThrow();
});

import { it, expect } from 'vitest';
import { portableFixture } from '../../../automation_test/common_setup/fixtures/portable';
import { validatePortable, canonicalJSON } from './portable';
import { dueReminder, reminderMilestones } from './reminders';
it('round-trips original partial lunar dates, relations and separate event dates', () => {
  const data = portableFixture();
  expect(validatePortable(JSON.parse(JSON.stringify(data)))).toEqual(data);
  expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
});
it.each(['credentials', 'memberships', 'guestTokens'])(
  'rejects imported %s instead of activating permissions',
  (field) => {
    expect(() => validatePortable({ ...portableFixture(), [field]: [] })).toThrow();
  },
);
it('rejects cycles, missing references and duplicate IDs', () => {
  const data = portableFixture();
  data.relationships.push({ ...data.relationships[0], id: 'cycle', from: 'p1', to: 'p0' });
  expect(() => validatePortable(data)).toThrow('vòng lặp');
  data.relationships.pop();
  data.relationships[0].to = 'missing';
  expect(() => validatePortable(data)).toThrow('không có');
  data.relationships = [];
  data.people.push(data.people[0]);
  expect(() => validatePortable(data)).toThrow('trùng');
});
it('validates a 1,000-profile chain without recursion and caps the portable scope', () => {
  const data = portableFixture(1000);
  expect(validatePortable(data).relationships).toHaveLength(999);
  data.people.push({ ...data.people[0], id: 'too-much' });
  expect(() => validatePortable(data)).toThrow('hạn mức');
});
it('calculates 7/3 calendar days at 09:00 in event timezone across DST and year boundaries', () => {
  const vietnam = reminderMilestones('2090-01-01', 'Asia/Ho_Chi_Minh');
  expect(vietnam.map((m) => new Date(m.dueAtMs).toISOString())).toEqual([
    '2089-12-25T02:00:00.000Z',
    '2089-12-29T02:00:00.000Z',
  ]);
  const ny = reminderMilestones('2026-03-12', 'America/New_York');
  expect(ny.map((m) => new Date(m.dueAtMs).toISOString())).toEqual([
    '2026-03-05T14:00:00.000Z',
    '2026-03-09T13:00:00.000Z',
  ]);
  expect(() => reminderMilestones('bad-date', 'UTC')).toThrow();
  expect(() => reminderMilestones('2026-01-01', 'bad/zone')).toThrow();
});
it('does not catch up late publication, expired windows or reminders after event starts', () => {
  const due = 100000000;
  expect(dueReminder(due, due - 1, due + 999999, due)).toBe(true);
  expect(dueReminder(due, due + 1, due + 999999, due + 1)).toBe(false);
  expect(dueReminder(due, due - 1, due + 999999999, due + 86400000)).toBe(false);
  expect(dueReminder(due, NaN, due + 999999, due)).toBe(false);
  expect(dueReminder(due, due - 1, due, due)).toBe(false);
});

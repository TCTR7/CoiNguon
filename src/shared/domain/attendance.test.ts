import { describe, it, expect } from 'vitest';
import {
  attendanceTotals,
  parseAttendance,
  suggestedTables,
  type AttendanceResponse,
} from './attendance';
const response = (status: AttendanceResponse['status'], adults = 0, children = 0) => ({
  response: { status, adults, children, note: '' },
});
describe('attendance by household', () => {
  it('replaces four people with three rather than accumulating submissions', () => {
    const households = [response('attending', 3, 1), response('pending')];
    expect(attendanceTotals(households)).toMatchObject({
      people: 4,
      invited: 2,
      responded: 1,
      pending: 1,
    });
    households[0] = response('attending', 2, 1);
    expect(attendanceTotals(households)).toMatchObject({
      people: 3,
      adults: 2,
      children: 1,
      responded: 1,
    });
  });
  it('distinguishes invited, answered, attending and declined groups', () => {
    expect(
      attendanceTotals([response('attending', 2, 2), response('declined'), response('pending')]),
    ).toEqual({
      invited: 3,
      responded: 2,
      pending: 1,
      attending: 1,
      declined: 1,
      adults: 2,
      children: 2,
      people: 4,
    });
    expect(attendanceTotals([]).people).toBe(0);
  });
  it('allows children-only attendance without inventing an adult', () => {
    expect(
      parseAttendance({
        status: 'attending',
        adults: 0,
        children: 2,
        note: '  Cùng nhóm người thân  ',
      }),
    ).toEqual({ status: 'attending', adults: 0, children: 2, note: 'Cùng nhóm người thân' });
  });
  it('rejects fractional, negative, empty or inconsistent attendance', () => {
    for (const fields of [
      { adults: -1, children: 0 },
      { adults: 1.5, children: 0 },
      { adults: 0, children: 0 },
      { adults: '2', children: 0 },
      { adults: 500, children: 1 },
    ])
      expect(() => parseAttendance({ status: 'attending', note: '', ...fields })).toThrow();
    expect(() =>
      parseAttendance({ status: 'declined', adults: 1, children: 0, note: '' }),
    ).toThrow();
  });
  it('rounds table suggestions up and rejects an invalid table size', () => {
    expect(suggestedTables(17, 8)).toBe(3);
    expect(suggestedTables(16, 8)).toBe(2);
    expect(suggestedTables(0, 8)).toBe(0);
    for (const capacity of [0, -1, 2.5, 31, NaN]) expect(suggestedTables(4, capacity)).toBeNull();
  });
});

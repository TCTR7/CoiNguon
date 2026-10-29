import { describe, it, expect } from 'vitest';
import {
  anniversaryCandidate,
  lunarToSolar,
  solarToLunar,
  validCivilISO,
  type AnniversaryRule,
} from './anniversary';
const rule = (extra: Partial<AnniversaryRule> = {}): AnniversaryRule => ({
  id: 'p',
  version: 1,
  calendar: 'lunar',
  leapPolicy: 'unset',
  missingDayPolicy: 'unset',
  sourceDate: { day: 1, month: 1, year: null, calendar: 'lunar', leapMonth: false },
  ...extra,
});
describe('Vietnamese civil anniversary calendar', () => {
  it('matches Tet and the last day of lunar 2025 independently published by Government', () => {
    // thanglong.chinhphu.vn/...103251213194327667.htm: 16 Feb = 29 Chạp; 20 Feb = 4 Giêng.
    expect(lunarToSolar({ day: 1, month: 1, year: 2026 })).toEqual({
      day: 17,
      month: 2,
      year: 2026,
    });
    expect(solarToLunar({ day: 16, month: 2, year: 2026 })).toEqual({
      day: 29,
      month: 12,
      year: 2025,
      leapMonth: false,
    });
    expect(solarToLunar({ day: 20, month: 2, year: 2026 })).toEqual({
      day: 4,
      month: 1,
      year: 2026,
      leapMonth: false,
    });
  });
  it('distinguishes regular and leap months and rejects an absent leap month', () => {
    // Primary dated event: phatgiaonguyenthuy.com/article/tam-tang/vien-hai.html
    expect(lunarToSolar({ day: 1, month: 2, year: 2023 }, true)).toEqual({
      day: 22,
      month: 3,
      year: 2023,
    });
    expect(lunarToSolar({ day: 1, month: 2, year: 2023 }, false)).toEqual({
      day: 20,
      month: 2,
      year: 2023,
    });
    expect(lunarToSolar({ day: 1, month: 2, year: 2026 }, true)).toBeNull();
  });
  it('requires an explicit leap-month policy; preferred leap falls back only when selected', () => {
    const r = rule({
      sourceDate: { day: 1, month: 2, year: 2023, calendar: 'lunar', leapMonth: true },
    });
    expect(anniversaryCandidate(r, 2026).date).toBeNull();
    expect(anniversaryCandidate({ ...r, leapPolicy: 'regular' }, 2023).date).toBe('2023-02-20');
    expect(anniversaryCandidate({ ...r, leapPolicy: 'prefer-leap' }, 2023).date).toBe('2023-03-22');
    expect(anniversaryCandidate({ ...r, leapPolicy: 'prefer-leap' }, 2026).date).not.toBeNull();
  });
  it('does not invent a day 30 in a short month and uses last day only with consent', () => {
    const r = rule({
      sourceDate: { day: 30, month: 12, year: null, calendar: 'lunar', leapMonth: false },
    });
    expect(anniversaryCandidate(r, 2025).date).toBeNull();
    expect(anniversaryCandidate({ ...r, missingDayPolicy: 'manual' }, 2025).date).toBeNull();
    expect(anniversaryCandidate({ ...r, missingDayPolicy: 'last-day' }, 2025).date).toBe(
      '2026-02-16',
    );
  });
  it('can repeat a known month/day without a year, but cannot convert an incomplete original', () => {
    expect(anniversaryCandidate(rule(), 2026).date).toBe('2026-02-17');
    expect(anniversaryCandidate(rule({ calendar: 'solar' }), 2026).date).toBeNull();
    expect(
      anniversaryCandidate(
        rule({
          sourceDate: { day: null, month: 1, year: 1990, calendar: 'lunar', leapMonth: false },
        }),
        2026,
      ).date,
    ).toBeNull();
  });
  it('handles Gregorian leap days and rejects invalid or unsupported years', () => {
    const r = rule({
      calendar: 'solar',
      sourceDate: { day: 29, month: 2, year: 2000, calendar: 'solar', leapMonth: false },
    });
    expect(anniversaryCandidate(r, 2025).date).toBeNull();
    expect(anniversaryCandidate({ ...r, missingDayPolicy: 'last-day' }, 2025).date).toBe(
      '2025-02-28',
    );
    expect(anniversaryCandidate(r, 2024).date).toBe('2024-02-29');
    expect(anniversaryCandidate(r, 1899).date).toBeNull();
    expect(validCivilISO('2025-02-30')).toBe(false);
    expect(validCivilISO('2024-02-29')).toBe(true);
  });
  it('converts complete original dates without modifying the source', () => {
    const r = rule({
      sourceDate: { day: 17, month: 2, year: 2026, calendar: 'solar', leapMonth: false },
    });
    expect(anniversaryCandidate(r, 2027).date).toBe('2027-02-06');
    expect(r.sourceDate.calendar).toBe('solar');
    expect(r.sourceDate.day).toBe(17);
  });
});

import { describe, it, expect } from 'vitest';
import {
  blankDate,
  blankPerson,
  validatePerson,
  validateFamilyDate,
  createsAncestryCycle,
  descendantLayers,
  formatFamilyDate,
  normalizedName,
  type FamilyRelationship,
} from './genealogy';
const edge = (
  from: string,
  to: string,
  extra: Partial<FamilyRelationship> = {},
): FamilyRelationship => ({
  id: from + '_' + to,
  from,
  to,
  kind: 'parent',
  parentType: 'biological',
  status: 'current',
  source: 'Gia phả mẫu',
  verified: true,
  version: 1,
  archived: false,
  ...extra,
});
describe('original family dates', () => {
  it('preserves a year-only date and a day/month without a year', () => {
    expect(validateFamilyDate({ ...blankDate(), year: 1932 })).toEqual({
      ...blankDate(),
      year: 1932,
    });
    expect(formatFamilyDate({ ...blankDate(), day: 10, month: 4 })).toBe('10/04/? · Dương lịch');
  });
  it('rejects invalid Gregorian dates without rejecting valid leap years', () => {
    expect(() => validateFamilyDate({ ...blankDate(), day: 29, month: 2, year: 1900 })).toThrow();
    expect(validateFamilyDate({ ...blankDate(), day: 29, month: 2, year: 2000 })).toMatchObject({
      day: 29,
    });
    expect(() => validateFamilyDate({ ...blankDate(), day: 31, month: 4 })).toThrow();
  });
  it('keeps lunar leap-month data without guessing a solar date', () => {
    expect(
      validateFamilyDate({ day: 30, month: 2, year: null, calendar: 'lunar', leapMonth: true }),
    ).toEqual({ day: 30, month: 2, year: null, calendar: 'lunar', leapMonth: true });
    expect(() => validateFamilyDate({ ...blankDate(), leapMonth: true })).toThrow();
  });
  it('rejects fractions, missing schema fields and impossible life dates', () => {
    expect(() => validateFamilyDate({ ...blankDate(), day: 1.5 })).toThrow();
    expect(() => validateFamilyDate({ year: 1960 })).toThrow();
    expect(() =>
      validatePerson({
        ...blankPerson(),
        name: 'Người thử',
        lifeStatus: 'living',
        death: { ...blankDate(), year: 2000 },
      }),
    ).toThrow();
    expect(() =>
      validatePerson({
        ...blankPerson(),
        name: 'Người thử',
        lifeStatus: 'deceased',
        birth: { ...blankDate(), year: 2000, month: 2, day: 1 },
        death: { ...blankDate(), year: 1999, month: 2, day: 1 },
      }),
    ).toThrow();
  });
  it('requires provenance for verified profiles and never accepts injected role fields', () => {
    expect(() => validatePerson({ ...blankPerson(), name: 'Người thử', verified: true })).toThrow();
    expect(() => validatePerson({ ...blankPerson(), name: 'Người thử', role: 'admin' })).toThrow();
  });
});
describe('family graph', () => {
  it('detects self, direct and deep ancestry cycles including adoptive parents', () => {
    const graph = [edge('a', 'b'), edge('b', 'c', { parentType: 'adoptive' })];
    expect(createsAncestryCycle(graph, 'c', 'a')).toBe(true);
    expect(createsAncestryCycle(graph, 'b', 'a')).toBe(true);
    expect(createsAncestryCycle(graph, 'a', 'a')).toBe(true);
    expect(createsAncestryCycle(graph, 'a', 'd')).toBe(false);
  });
  it('does not mistake former spouses or removed edges for ancestry', () => {
    expect(
      createsAncestryCycle([edge('a', 'b', { kind: 'spouse', status: 'former' })], 'b', 'a'),
    ).toBe(false);
    expect(createsAncestryCycle([edge('a', 'b', { archived: true })], 'b', 'a')).toBe(false);
  });
  it('uses verified parent relationships and marks conflicting generation depths', () => {
    const graph = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('a', 'c'),
      edge('a', 'd', { verified: false }),
    ];
    const layers = descendantLayers('a', graph);
    expect([...layers.get('c')!].sort()).toEqual([1, 2]);
    expect(layers.has('d')).toBe(false);
  });
  it('normalizes Vietnamese names for suggestions without merging identities', () => {
    expect(normalizedName('  ĐẶNG Thị HỒNG ')).toBe('dang thi hong');
  });
});

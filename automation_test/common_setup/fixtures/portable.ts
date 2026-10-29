import { blankPerson } from '../../../src/shared/domain/genealogy';
import type { PortableData } from '../../../src/shared/domain/portable';
export function portableFixture(count = 2): PortableData {
  const death = { day: 1, month: 1, year: 2000, calendar: 'solar' as const, leapMonth: false };
  return {
    schemaVersion: 1,
    scope: 'genealogy-calendar',
    clanName: 'Gia phả dữ liệu giả',
    exportedAtUTC: '2089-01-01T00:00:00Z',
    people: Array.from({ length: count }, (_, i) => ({
      ...blankPerson(),
      id: 'p' + i,
      name: 'Người Mẫu ' + i,
      lifeStatus: 'deceased',
      death,
      birth: { day: null, month: null, year: 1930, calendar: 'lunar', leapMonth: false },
      version: 1,
      archived: false,
    })),
    relationships: Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({
      id: 'r' + i,
      from: 'p' + i,
      to: 'p' + (i + 1),
      kind: 'parent',
      parentType: i % 2 ? 'adoptive' : 'biological',
      status: 'current',
      source: '',
      verified: false,
      version: 1,
      archived: false,
    })),
    rules: [
      {
        id: 'p0',
        calendar: 'solar',
        leapPolicy: 'unset',
        missingDayPolicy: 'unset',
        sourceDate: death,
        version: 1,
      },
    ],
    events: [
      {
        id: 'p0_2090',
        personId: 'p0',
        personName: 'Người Mẫu 0',
        year: 2090,
        status: 'published',
        version: 1,
        reminderRevision: 1,
        dateConfirmed: true,
        sourceDate: death,
        ruleVersion: 1,
        anniversaryDate: '2090-01-01',
        confirmationNote: '',
        scheduledDate: '2090-01-01',
        scheduledTime: '10:00',
        timeZone: 'Asia/Ho_Chi_Minh',
        startsAtUTC: '2090-01-01T03:00:00Z',
        rsvpDeadlineLocal: '2089-12-31T18:00',
        deadlineAtUTC: '2089-12-31T11:00:00Z',
        address: 'Địa điểm mẫu',
        invitationText: '',
      },
    ],
  };
}

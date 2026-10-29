import { LunarDate, SolarDate } from 'lunar-date-vn';
import type { CalendarKind, FamilyDate } from './genealogy';

export interface AnniversaryRule {
  id: string;
  calendar: CalendarKind;
  leapPolicy: 'unset' | 'regular' | 'prefer-leap';
  missingDayPolicy: 'unset' | 'last-day' | 'manual';
  sourceDate: FamilyDate;
  version: number;
}
export interface HostAssignment {
  id: string;
  hostUid: string;
  hostEpoch: string;
  version: number;
}
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export interface MemorialEvent {
  id: string;
  personId: string;
  personName: string;
  year: number;
  status: EventStatus;
  version: number;
  reminderRevision: number;
  anniversaryDate: string;
  dateConfirmed: boolean;
  confirmationNote: string;
  ruleVersion: number;
  sourceDate: FamilyDate;
  scheduledDate: string;
  scheduledTime: string;
  timeZone: string;
  startsAtUTC: string;
  rsvpDeadlineLocal: string;
  deadlineAtUTC: string;
  address: string;
  invitationText: string;
  delegateUid: string;
  delegateEpoch: string;
  delegateAssignmentVersion: number;
}
export interface Delegation {
  id: string;
  scope: 'permanent' | 'event';
  personId: string;
  eventId: string;
  fromUid: string;
  toUid: string;
  fromEpoch: string;
  toEpoch: string;
  assignmentVersion: number;
  eventVersion: number;
  expiresAtMs: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  version: number;
  resolution: string;
}
type Civil = { day: number; month: number; year: number };
export const civilISO = (d: Civil) =>
  String(d.year).padStart(4, '0') +
  '-' +
  String(d.month).padStart(2, '0') +
  '-' +
  String(d.day).padStart(2, '0');
export function validCivilISO(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export const sameDate = (a: FamilyDate, b: FamilyDate) =>
  a.calendar === b.calendar &&
  a.day === b.day &&
  a.month === b.month &&
  a.year === b.year &&
  a.leapMonth === b.leapMonth;
// Civil parts only; round-trip rejects the library's normalization of absent leap months.
export function lunarToSolar(d: Civil, leapMonth = false): Civil | null {
  try {
    if (d.year < 1900 || d.year > 2099) return null;
    const lunar = new LunarDate({ ...d, hour: 0, yearIndex: 0, leap_month: leapMonth });
    lunar.init(true);
    const solar = lunar.toSolarDate();
    const back = solar?.toLunarDate()?.get();
    if (
      !solar ||
      !back ||
      back.day !== d.day ||
      back.month !== d.month ||
      back.year !== d.year ||
      !!back.leap_month !== leapMonth
    )
      return null;
    const result = solar.get();
    return { day: result.day, month: result.month, year: result.year };
  } catch {
    return null;
  }
}
export function solarToLunar(d: Civil): (Civil & { leapMonth: boolean }) | null {
  try {
    if (d.year < 1900 || d.year > 2100 || !validCivilISO(civilISO(d))) return null;
    const result = new SolarDate({ ...d, hour: 0, yearIndex: 0 }).toLunarDate()?.get();
    return result
      ? { day: result.day, month: result.month, year: result.year, leapMonth: !!result.leap_month }
      : null;
  } catch {
    return null;
  }
}
export function validateRule(
  value: unknown,
): Pick<AnniversaryRule, 'calendar' | 'leapPolicy' | 'missingDayPolicy'> {
  const r = value as Partial<AnniversaryRule> | null;
  if (
    !r ||
    !['solar', 'lunar'].includes(String(r.calendar)) ||
    !['unset', 'regular', 'prefer-leap'].includes(String(r.leapPolicy)) ||
    !['unset', 'last-day', 'manual'].includes(String(r.missingDayPolicy))
  )
    throw new Error('Quy tắc lịch giỗ không hợp lệ.');
  return {
    calendar: r.calendar!,
    leapPolicy: r.leapPolicy!,
    missingDayPolicy: r.missingDayPolicy!,
  };
}
export function anniversaryCandidate(
  rule: Omit<AnniversaryRule, 'id' | 'version'>,
  year: number,
): { date: string | null; explanation: string } {
  const unresolved = (explanation: string) => ({ date: null, explanation });
  if (!Number.isInteger(year) || year < 1900 || year > 2099)
    return unresolved('Lịch giỗ hỗ trợ năm 1900–2099.');
  let source = rule.sourceDate;
  if (!source.day || !source.month)
    return unresolved(
      'Ngày mất còn thiếu ngày hoặc tháng. Cần gia đình xác nhận riêng cho năm này.',
    );
  if (source.calendar !== rule.calendar) {
    if (!source.year) return unresolved('Thiếu năm mất nên chưa thể đổi loại lịch.');
    const converted =
      source.calendar === 'solar'
        ? solarToLunar({ day: source.day, month: source.month, year: source.year })
        : lunarToSolar(
            { day: source.day, month: source.month, year: source.year },
            source.leapMonth,
          );
    if (!converted) return unresolved('Ngày gốc chưa đổi lịch được trong phạm vi hỗ trợ.');
    source = {
      ...converted,
      calendar: rule.calendar,
      leapMonth: 'leapMonth' in converted ? !!converted.leapMonth : false,
    };
  } else if (
    source.year &&
    source.calendar === 'lunar' &&
    !lunarToSolar({ day: source.day, month: source.month, year: source.year }, source.leapMonth)
  )
    return unresolved(
      'Ngày âm gốc không hợp lệ hoặc ngoài phạm vi đối chiếu; cần xác nhận thủ công.',
    );
  if (source.year && year < source.year) return unresolved('Năm giỗ không thể trước năm mất.');
  const civil = { day: source.day!, month: source.month!, year };
  let date: string | null = null;
  let explanation = 'Ngày giỗ tính theo quy tắc đã lưu; vẫn cần người phụ trách xác nhận.';
  if (rule.calendar === 'solar') {
    date = validCivilISO(civilISO(civil)) ? civilISO(civil) : null;
    if (!date && rule.missingDayPolicy === 'last-day') {
      date = civilISO({ ...civil, day: 28 });
      explanation = 'Năm không có 29/02: dùng ngày cuối tháng theo lựa chọn của gia đình.';
    }
  } else {
    if (source.leapMonth && rule.leapPolicy === 'unset')
      return unresolved(
        'Ngày mất thuộc tháng nhuận. Hãy chọn cách tính hoặc xác nhận riêng năm này.',
      );
    const leap =
      source.leapMonth &&
      rule.leapPolicy === 'prefer-leap' &&
      !!lunarToSolar({ ...civil, day: 1 }, true);
    let solar = lunarToSolar(civil, leap);
    if (!solar && rule.missingDayPolicy === 'last-day' && civil.day === 30) {
      solar = lunarToSolar({ ...civil, day: 29 }, leap);
      explanation = 'Tháng âm chỉ có 29 ngày: dùng ngày cuối tháng theo lựa chọn của gia đình.';
    }
    date = solar ? civilISO(solar) : null;
  }
  return date
    ? { date, explanation }
    : unresolved(
        'Năm này không có ngày đã chọn. Cần chọn ngày cuối tháng hoặc xác nhận ngày thủ công.',
      );
}
export const eventStatusLabels: Record<EventStatus, string> = {
  draft: 'Bản nháp',
  published: 'Đã công bố',
  cancelled: 'Đã hủy',
  completed: 'Hoàn tất',
};
export function confirmationCurrent(
  event: MemorialEvent,
  rule: AnniversaryRule | undefined,
  death: FamilyDate,
) {
  return (
    !!rule &&
    event.dateConfirmed &&
    event.ruleVersion === rule.version &&
    sameDate(event.sourceDate, death) &&
    sameDate(rule.sourceDate, death)
  );
}

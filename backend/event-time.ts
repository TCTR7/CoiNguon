import { Temporal } from '@js-temporal/polyfill';
import { validCivilISO } from '../src/shared/domain/anniversary.ts';
import { ApiError } from './service.ts';

export function localInstant(date: string, time: string, timeZone: string) {
  try {
    if (
      !validCivilISO(date) ||
      !/^\d{2}:\d{2}$/.test(time) ||
      (!timeZone.includes('/') && timeZone !== 'UTC')
    )
      throw new Error();
    new Intl.DateTimeFormat('en', { timeZone }).format();
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return Temporal.ZonedDateTime.from(
      { year, month, day, hour, minute, timeZone },
      { overflow: 'reject', disambiguation: 'reject' },
    )
      .toInstant()
      .toString();
  } catch {
    throw new ApiError(
      400,
      'Ngày, giờ hoặc múi giờ không hợp lệ (kể cả giờ bị trùng/thiếu do đổi giờ mùa hè).',
    );
  }
}
export function eventTimes(date: string, time: string, zone: string, deadline: string) {
  // A draft may have a day without an agreed time. Never invent midnight.
  try {
    if (
      (!zone.includes('/') && zone !== 'UTC') ||
      (date && !validCivilISO(date)) ||
      (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    )
      throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: zone }).format();
  } catch {
    throw new ApiError(400, 'Ngày, giờ hoặc múi giờ không hợp lệ.');
  }
  const startsAtUTC = date && time ? localInstant(date, time, zone) : '';
  if (deadline && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline))
    throw new ApiError(400, 'Hạn phản hồi cần ngày và giờ tại địa điểm tổ chức.');
  const deadlineAtUTC = deadline
    ? localInstant(deadline.slice(0, 10), deadline.slice(11), zone)
    : '';
  if (deadlineAtUTC && (!startsAtUTC || Temporal.Instant.compare(deadlineAtUTC, startsAtUTC) > 0))
    throw new ApiError(400, 'Hạn phản hồi không thể sau giờ tổ chức.');
  return { startsAtUTC, deadlineAtUTC };
}

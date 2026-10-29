import { Temporal } from '@js-temporal/polyfill';
export const reminderOffsets = [7, 3] as const;
export function reminderMilestones(date: string, timeZone: string) {
  const day = Temporal.PlainDate.from(date);
  return reminderOffsets.map((offset) => {
    const target = day.subtract({ days: offset });
    const instant = Temporal.ZonedDateTime.from(
      { year: target.year, month: target.month, day: target.day, hour: 9, minute: 0, timeZone },
      { disambiguation: 'reject' },
    ).toInstant();
    return { offset, dueAtMs: Number(instant.epochMilliseconds) };
  });
}
export function dueReminder(
  dueAtMs: number,
  publishedSinceMs: number,
  startsAtMs: number,
  now: number,
) {
  return (
    Number.isFinite(publishedSinceMs) &&
    dueAtMs >= publishedSinceMs &&
    now >= dueAtMs &&
    now < dueAtMs + 86400000 &&
    now < startsAtMs
  );
}

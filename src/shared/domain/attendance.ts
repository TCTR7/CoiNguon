export type AttendanceStatus = 'pending' | 'attending' | 'declined';
export interface AttendanceResponse {
  status: AttendanceStatus;
  adults: number;
  children: number;
  note: string;
}
export const attendanceLabels: Record<AttendanceStatus, string> = {
  pending: 'Chưa phản hồi',
  attending: 'Có tham dự',
  declined: 'Không tham dự',
};
export function parseAttendance(input: Record<string, unknown>): AttendanceResponse {
  if (input.status !== 'attending' && input.status !== 'declined')
    throw new Error('Chọn tham dự hoặc không tham dự.');
  const { adults, children, note } = input;
  if (
    typeof adults !== 'number' ||
    typeof children !== 'number' ||
    !Number.isInteger(adults) ||
    !Number.isInteger(children) ||
    adults < 0 ||
    children < 0 ||
    adults + children > 500
  )
    throw new Error('Số người phải là số nguyên không âm, tổng không quá 500.');
  if (input.status === 'attending' ? adults + children === 0 : adults + children !== 0)
    throw new Error(
      input.status === 'attending'
        ? 'Tham dự cần ít nhất một người.'
        : 'Không tham dự cần để số người bằng 0.',
    );
  if (typeof note !== 'string' || note.trim().length > 500)
    throw new Error('Ghi chú tối đa 500 ký tự.');
  return { status: input.status, adults, children, note: note.trim() };
}
export function attendanceTotals(groups: { response: AttendanceResponse }[]) {
  let responded = 0,
    attending = 0,
    declined = 0,
    adults = 0,
    children = 0;
  for (const { response: r } of groups) {
    if (r.status === 'attending') {
      responded++;
      attending++;
      adults += r.adults;
      children += r.children;
    }
    if (r.status === 'declined') {
      responded++;
      declined++;
    }
  }
  return {
    invited: groups.length,
    responded,
    pending: groups.length - responded,
    attending,
    declined,
    adults,
    children,
    people: adults + children,
  };
}
export function suggestedTables(people: number, seats: number) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 30) return null;
  return Math.ceil(people / seats);
}

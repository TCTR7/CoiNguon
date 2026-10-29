export type CalendarKind = 'solar' | 'lunar';
export interface FamilyDate {
  day: number | null;
  month: number | null;
  year: number | null;
  calendar: CalendarKind;
  leapMonth: boolean;
}
export interface PersonFields {
  name: string;
  aliases: string;
  lifeStatus: 'living' | 'deceased' | 'unknown';
  birth: FamilyDate;
  death: FamilyDate;
  branch: string;
  biography: string;
  source: string;
  verified: boolean;
}
export interface FamilyPerson extends PersonFields {
  id: string;
  version: number;
  archived: boolean;
}
export interface FamilyRelationship {
  id: string;
  from: string;
  to: string;
  kind: 'parent' | 'spouse';
  parentType: 'biological' | 'adoptive';
  status: 'current' | 'former';
  source: string;
  verified: boolean;
  version: number;
  archived: boolean;
}
export interface PersonRequest {
  id: string;
  personId: string;
  personName: string;
  uid: string;
  displayName: string;
  kind: 'claim' | 'correction';
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  resolution: string;
  version: number;
}
export interface PersonLink {
  id: string;
  uid: string;
  personId: string;
}
export const blankDate = (): FamilyDate => ({
  day: null,
  month: null,
  year: null,
  calendar: 'solar',
  leapMonth: false,
});
export const blankPerson = (): PersonFields => ({
  name: '',
  aliases: '',
  lifeStatus: 'unknown',
  birth: blankDate(),
  death: blankDate(),
  branch: '',
  biography: '',
  source: '',
  verified: false,
});
export const normalizedName = (value: string) =>
  value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Dữ liệu không hợp lệ.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number, min = 0) {
  if (typeof value !== 'string') throw new Error(label + ' phải là văn bản.');
  const result = value.trim();
  if (result.length < min || result.length > max)
    throw new Error(label + ' cần từ ' + min + ' đến ' + max + ' ký tự.');
  return result;
}
export function validateFamilyDate(value: unknown): FamilyDate {
  const d = record(value);
  if (d.calendar !== 'solar' && d.calendar !== 'lunar')
    throw new Error('Chọn rõ lịch âm hoặc dương.');
  for (const [key, max] of [
    ['day', d.calendar === 'lunar' ? 30 : 31],
    ['month', 12],
    ['year', 9999],
  ] as const) {
    const n = d[key];
    if (n !== null && (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > max))
      throw new Error('Ngày, tháng hoặc năm không hợp lệ.');
  }
  if (
    typeof d.leapMonth !== 'boolean' ||
    (d.leapMonth && (d.calendar !== 'lunar' || d.month === null))
  )
    throw new Error('Tháng nhuận cần tháng âm lịch cụ thể.');
  if (d.calendar === 'solar' && d.day !== null && d.month !== null) {
    const year = d.year as number | null;
    const leap = year === null || year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    const max = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
      (d.month as number) - 1
    ];
    if ((d.day as number) > max)
      throw new Error('Ngày không tồn tại trong tháng dương lịch đã chọn.');
  }
  return {
    day: d.day as number | null,
    month: d.month as number | null,
    year: d.year as number | null,
    calendar: d.calendar,
    leapMonth: d.leapMonth,
  };
}
export function validatePerson(value: unknown): PersonFields {
  const p = record(value);
  const allowed = [
    'name',
    'aliases',
    'lifeStatus',
    'birth',
    'death',
    'branch',
    'biography',
    'source',
    'verified',
  ];
  if (Object.keys(p).some((k) => !allowed.includes(k)))
    throw new Error('Hồ sơ có trường không được hỗ trợ.');
  if (!['living', 'deceased', 'unknown'].includes(String(p.lifeStatus)))
    throw new Error('Trạng thái còn sống/đã mất chưa hợp lệ.');
  if (typeof p.verified !== 'boolean') throw new Error('Trạng thái xác minh không hợp lệ.');
  const birth = validateFamilyDate(p.birth),
    death = validateFamilyDate(p.death);
  if (p.lifeStatus !== 'deceased' && [death.day, death.month, death.year].some((n) => n !== null))
    throw new Error('Chỉ nhập ngày mất khi đã chọn Đã mất.');
  if (
    birth.calendar === 'solar' &&
    death.calendar === 'solar' &&
    [birth.day, birth.month, birth.year, death.day, death.month, death.year].every(
      (n) => n !== null,
    )
  ) {
    const stamp = (d: FamilyDate) => d.year! * 10000 + d.month! * 100 + d.day!;
    if (stamp(death) < stamp(birth)) throw new Error('Ngày mất không thể trước ngày sinh.');
  }
  const source = text(p.source, 'Nguồn thông tin', 500);
  if (p.verified && !source) throw new Error('Hồ sơ đã xác minh cần ghi nguồn thông tin.');
  return {
    name: text(p.name, 'Tên hiển thị', 120, 2),
    aliases: text(p.aliases, 'Tên khác', 200),
    lifeStatus: p.lifeStatus as PersonFields['lifeStatus'],
    birth,
    death,
    branch: text(p.branch, 'Chi', 80),
    biography: text(p.biography, 'Tiểu sử', 5000),
    source,
    verified: p.verified,
  };
}
export function validateRelationship(
  value: unknown,
): Omit<FamilyRelationship, 'id' | 'version' | 'archived'> {
  const p = record(value);
  if (p.kind !== 'parent' && p.kind !== 'spouse') throw new Error('Loại quan hệ không hợp lệ.');
  const from = text(p.from, 'Người thứ nhất', 80, 1),
    to = text(p.to, 'Người thứ hai', 80, 1);
  if (from === to) throw new Error('Không thể tạo quan hệ với chính mình.');
  if (
    !['biological', 'adoptive'].includes(String(p.parentType)) ||
    !['current', 'former'].includes(String(p.status)) ||
    typeof p.verified !== 'boolean'
  )
    throw new Error('Thông tin quan hệ không hợp lệ.');
  const source = text(p.source, 'Nguồn quan hệ', 500);
  if (p.verified && !source) throw new Error('Quan hệ đã xác minh cần ghi nguồn thông tin.');
  return {
    from,
    to,
    kind: p.kind,
    parentType: p.parentType as 'biological' | 'adoptive',
    status: p.status as 'current' | 'former',
    source,
    verified: p.verified,
  };
}
export function createsAncestryCycle(
  edges: Pick<FamilyRelationship, 'from' | 'to' | 'kind' | 'archived'>[],
  from: string,
  to: string,
) {
  const children = new Map<string, string[]>();
  for (const edge of edges)
    if (!edge.archived && edge.kind === 'parent')
      children.set(edge.from, [...(children.get(edge.from) || []), edge.to]);
  const seen = new Set<string>(),
    stack = [to];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) || []));
  }
  return false;
}
export function formatFamilyDate(date: FamilyDate) {
  const fields = [
    date.day === null ? '?' : String(date.day).padStart(2, '0'),
    date.month === null ? '?' : String(date.month).padStart(2, '0'),
    date.year === null ? '?' : String(date.year),
  ];
  if ([date.day, date.month, date.year].every((n) => n === null)) return 'Chưa rõ';
  return (
    fields.join('/') +
    ' · ' +
    (date.calendar === 'lunar' ? 'Âm lịch' : 'Dương lịch') +
    (date.leapMonth ? ' (tháng nhuận)' : '')
  );
}
export function descendantLayers(root: string, edges: FamilyRelationship[]) {
  const levels = new Map<string, Set<number>>([[root, new Set([0])]]);
  const pending: [string, number][] = [[root, 0]];
  while (pending.length) {
    const [id, depth] = pending.shift()!;
    for (const e of edges)
      if (!e.archived && e.verified && e.kind === 'parent' && e.from === id) {
        const values = levels.get(e.to) || new Set<number>();
        if (!values.has(depth + 1) && depth < 1000) {
          values.add(depth + 1);
          levels.set(e.to, values);
          pending.push([e.to, depth + 1]);
        }
      }
  }
  return levels;
}

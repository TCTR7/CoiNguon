import {
  validatePerson,
  validateRelationship,
  validateFamilyDate,
  type FamilyPerson,
  type FamilyRelationship,
} from './genealogy.ts';
import {
  validateRule,
  validCivilISO,
  type AnniversaryRule,
  type MemorialEvent,
} from './anniversary.ts';
export type PortableEvent = Omit<
  MemorialEvent,
  'delegateUid' | 'delegateEpoch' | 'delegateAssignmentVersion'
>;
export interface PortableData {
  schemaVersion: 1;
  scope: 'genealogy-calendar';
  clanName: string;
  exportedAtUTC: string;
  people: FamilyPerson[];
  relationships: FamilyRelationship[];
  rules: AnniversaryRule[];
  events: PortableEvent[];
}
export interface OfflineSnapshot extends PortableData {
  uid: string;
  clanId: string;
  membershipEpoch: string;
  downloadedAtMs: number;
}
export const personFields = [
  'name',
  'aliases',
  'lifeStatus',
  'birth',
  'death',
  'branch',
  'biography',
  'source',
  'verified',
] as const;
export const relationshipFields = [
  'from',
  'to',
  'kind',
  'parentType',
  'status',
  'source',
  'verified',
] as const;
export const eventFields = [
  'personId',
  'personName',
  'year',
  'status',
  'version',
  'reminderRevision',
  'anniversaryDate',
  'dateConfirmed',
  'confirmationNote',
  'ruleVersion',
  'sourceDate',
  'scheduledDate',
  'scheduledTime',
  'timeZone',
  'startsAtUTC',
  'rsvpDeadlineLocal',
  'deadlineAtUTC',
  'address',
  'invitationText',
] as const;
export const pick = (data: Record<string, unknown>, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, data[key]]));
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Tệp sao lưu không hợp lệ.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, min = 0) {
  if (typeof value !== 'string' || value.length < min || value.length > max)
    throw new Error('Văn bản trong tệp bị thiếu hoặc quá dài.');
  return value;
}
function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))
    throw new Error('ID trong tệp không hợp lệ.');
  return value;
}
function integer(value: unknown, min = 1, max = 100000000) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw new Error('Phiên bản hoặc số năm không hợp lệ.');
  return value;
}
function rows(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max)
    throw new Error('Tệp vượt hạn mức local: 1.000 hồ sơ, 5.000 quan hệ, 2.000 sự kiện.');
  const seen = new Set<string>();
  return value.map((item) => {
    const row = object(item),
      key = id(row.id);
    if (seen.has(key)) throw new Error('ID bị trùng trong tệp.');
    seen.add(key);
    return row;
  });
}
function keys(row: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(row).some((key) => !allowed.includes(key)))
    throw new Error(
      'Tệp chứa trường ngoài phạm vi gia phả/lịch; không nhập tài khoản hoặc quyền từ tệp.',
    );
}
export function validatePortable(value: unknown): PortableData {
  const data = object(value);
  keys(data, [
    'schemaVersion',
    'scope',
    'clanName',
    'exportedAtUTC',
    'people',
    'relationships',
    'rules',
    'events',
  ]);
  if (data.schemaVersion !== 1 || data.scope !== 'genealogy-calendar')
    throw new Error('Chưa hỗ trợ phiên bản hoặc phạm vi tệp này.');
  const clanName = text(data.clanName, 80, 2),
    exportedAtUTC = text(data.exportedAtUTC, 40, 1);
  if (!Number.isFinite(Date.parse(exportedAtUTC)))
    throw new Error('Thời điểm xuất tệp không hợp lệ.');
  const people = rows(data.people, 1000).map((row) => {
    keys(row, ['id', 'version', 'archived', ...personFields]);
    if (typeof row.archived !== 'boolean') throw new Error('Trạng thái hồ sơ không hợp lệ.');
    if (typeof row.lifeStatus !== 'string') throw new Error('Trạng thái hồ sơ không hợp lệ.');
    return {
      ...validatePerson(pick(row, personFields)),
      id: id(row.id),
      version: integer(row.version),
      archived: row.archived,
    };
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const relationships = rows(data.relationships, 5000).map((row) => {
    keys(row, ['id', 'version', 'archived', ...relationshipFields]);
    if (typeof row.archived !== 'boolean') throw new Error('Trạng thái quan hệ không hợp lệ.');
    if (typeof row.parentType !== 'string' || typeof row.status !== 'string')
      throw new Error('Loại quan hệ không hợp lệ.');
    const fields = validateRelationship(pick(row, relationshipFields));
    if (!byId.has(fields.from) || !byId.has(fields.to))
      throw new Error('Quan hệ trỏ tới hồ sơ không có trong tệp.');
    if (!row.archived && (byId.get(fields.from)!.archived || byId.get(fields.to)!.archived))
      throw new Error('Quan hệ đang hoạt động không được nối hồ sơ đã lưu trữ.');
    return { ...fields, id: id(row.id), version: integer(row.version), archived: row.archived };
  });
  // Kahn's algorithm keeps validation linear for the 1,000-profile pilot fixture.
  const children = new Map<string, string[]>(),
    degree = new Map(people.map((p) => [p.id, 0]));
  for (const edge of relationships)
    if (!edge.archived && edge.kind === 'parent') {
      children.set(edge.from, [...(children.get(edge.from) || []), edge.to]);
      degree.set(edge.to, degree.get(edge.to)! + 1);
    }
  const queue = [...degree].filter(([, n]) => n === 0).map(([key]) => key);
  let visited = 0;
  for (let index = 0; index < queue.length; index++) {
    const key = queue[index];
    visited++;
    for (const child of children.get(key) || []) {
      const n = degree.get(child)! - 1;
      degree.set(child, n);
      if (n === 0) queue.push(child);
    }
  }
  if (visited !== people.length) throw new Error('Tệp có vòng lặp tổ tiên.');
  const rules = rows(data.rules, 1000).map((row) => {
    keys(row, ['id', 'version', 'sourceDate', 'calendar', 'leapPolicy', 'missingDayPolicy']);
    if (!byId.has(id(row.id))) throw new Error('Quy tắc không có hồ sơ tương ứng.');
    for (const field of ['calendar', 'leapPolicy', 'missingDayPolicy'])
      if (typeof row[field] !== 'string') throw new Error('Quy tắc không hợp lệ.');
    return {
      ...validateRule(row),
      id: id(row.id),
      version: integer(row.version),
      sourceDate: validateFamilyDate(row.sourceDate),
    };
  });
  const events = rows(data.events, 2000).map((row) => {
    keys(row, ['id', ...eventFields]);
    const personId = id(row.personId),
      year = integer(row.year, 1900, 2099);
    if (!byId.has(personId) || row.id !== personId + '_' + year)
      throw new Error('Sự kiện không đúng hồ sơ/năm.');
    if (
      typeof row.status !== 'string' ||
      !['draft', 'published', 'cancelled', 'completed'].includes(row.status) ||
      typeof row.dateConfirmed !== 'boolean'
    )
      throw new Error('Trạng thái sự kiện không hợp lệ.');
    const fields = {
      ...pick(row, eventFields),
      id: id(row.id),
      personId,
      year,
      version: integer(row.version),
      reminderRevision: integer(row.reminderRevision),
      ruleVersion: integer(row.ruleVersion),
      sourceDate: validateFamilyDate(row.sourceDate),
    };
    for (const key of ['personName', 'timeZone']) text(row[key], 120, 1);
    for (const key of ['address', 'confirmationNote']) text(row[key], 500);
    text(row.invitationText, 3000);
    for (const key of ['anniversaryDate', 'scheduledDate']) {
      const v = text(row[key], 10);
      if (v && !validCivilISO(v)) throw new Error('Ngày lịch trong sự kiện không hợp lệ.');
    }
    const time = text(row.scheduledTime, 5);
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error('Giờ sự kiện không hợp lệ.');
    for (const key of ['startsAtUTC', 'deadlineAtUTC']) {
      const v = text(row[key], 40);
      if (v && !Number.isFinite(Date.parse(v))) throw new Error('Thời điểm sự kiện không hợp lệ.');
    }
    text(row.rsvpDeadlineLocal, 16);
    try {
      new Intl.DateTimeFormat('vi', { timeZone: String(row.timeZone) }).format();
    } catch {
      throw new Error('Múi giờ không hợp lệ.');
    }
    return fields as unknown as PortableEvent;
  });
  return {
    schemaVersion: 1,
    scope: 'genealogy-calendar',
    clanName,
    exportedAtUTC,
    people,
    relationships,
    rules,
    events,
  };
}
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonicalJSON(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

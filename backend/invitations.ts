import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import { ApiError, store } from './service.ts';
import { memberEpoch } from './events.ts';
import { sameDate } from '../src/shared/domain/anniversary.ts';
import {
  attendanceTotals,
  parseAttendance,
  type AttendanceResponse,
} from '../src/shared/domain/attendance.ts';

const pending: AttendanceResponse = { status: 'pending', adults: 0, children: 0, note: '' };
function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(value))
    throw new ApiError(400, 'Mã đối tượng không hợp lệ.');
  return value;
}
function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new ApiError(400, 'Nội dung còn thiếu hoặc vượt giới hạn ký tự.');
  return value.trim();
}
function version(data: DocumentData | undefined, value: unknown) {
  if ((data?.version ?? null) !== value)
    throw new ApiError(
      409,
      'Thông tin đã thay đổi. Tải cập nhật trước khi thử lại; nội dung đang nhập được giữ.',
    );
}
function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
const unavailable = () =>
  new ApiError(404, 'Link thiệp không còn hiệu lực. Hãy liên hệ người mời để nhận link mới.');
function tokenHash(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw unavailable();
  return hash(value);
}
function response(body: Record<string, unknown>) {
  try {
    return parseAttendance(body);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
}
async function context(tx: Transaction, clanId: string, eventId: string, uid?: string) {
  const base = 'clans/' + clanId + '/';
  const eventRef = store.doc(base + 'events/' + eventId);
  const actorSnap = uid ? await tx.get(store.doc('memberships/' + clanId + '_' + uid)) : null;
  if (
    uid &&
    (!actorSnap?.exists || actorSnap.data()?.uid !== uid || actorSnap.data()?.clanId !== clanId)
  )
    throw new ApiError(403, 'Bạn không còn quyền truy cập dòng họ này.');
  const [clan, eventSnap, cardSnap] = await Promise.all([
    tx.get(store.doc('clans/' + clanId)),
    tx.get(eventRef),
    tx.get(store.doc(base + 'invitationSettings/' + eventId)),
  ]);
  const event = eventSnap.data();
  if (!clan.exists || !event) throw new ApiError(404, 'Không tìm thấy sự kiện.');
  const [person, rule, assignmentSnap] = await Promise.all([
    tx.get(store.doc(base + 'people/' + id(event.personId))),
    tx.get(store.doc(base + 'anniversaryRules/' + id(event.personId))),
    tx.get(store.doc(base + 'assignments/' + id(event.personId))),
  ]);
  const assignment = assignmentSnap.data();
  const host = assignment
    ? (await tx.get(store.doc('memberships/' + clanId + '_' + id(assignment.hostUid)))).data()
    : undefined;
  const hostActive = !!host && assignment?.hostEpoch === memberEpoch(host);
  const actor = actorSnap?.data();
  const manager =
    !!actor &&
    actor.uid === uid &&
    actor.clanId === clanId &&
    (actor.role === 'admin' ||
      (hostActive && assignment?.hostUid === uid) ||
      (hostActive &&
        event.delegateUid === uid &&
        event.delegateEpoch === memberEpoch(actor) &&
        event.delegateAssignmentVersion === assignment?.version &&
        !['completed', 'cancelled'].includes(event.status)));
  return {
    base,
    eventRef,
    event,
    card: cardSnap.data(),
    cardRef: cardSnap.ref,
    manager,
    hostActive,
    person: person.data(),
    rule: rule.data(),
    actor,
  };
}
type Context = Awaited<ReturnType<typeof context>>;
function confirmed(c: Context) {
  return (
    c.hostActive &&
    c.person &&
    !c.person.archived &&
    c.person.lifeStatus === 'deceased' &&
    c.rule &&
    c.event.dateConfirmed &&
    c.event.ruleVersion === c.rule.version &&
    sameDate(c.event.sourceDate, c.person.death) &&
    sameDate(c.rule.sourceDate, c.person.death) &&
    Number.isFinite(Date.parse(c.event.startsAtUTC)) &&
    Number.isFinite(Date.parse(c.event.deadlineAtUTC)) &&
    !!c.event.address
  );
}
function expiry(c: Context) {
  return Date.parse(c.event.startsAtUTC) + 7 * 86400000;
}
function open(c: Context) {
  if (c.event.status !== 'published' || !confirmed(c))
    throw new ApiError(
      409,
      'Cần sự kiện đã công bố với ngày hiện tại được xác nhận và chủ sự còn hoạt động.',
    );
}
function publicCard(c: Context) {
  return {
    title: c.card!.title,
    message: c.card!.message,
    contact: c.card!.contact,
    date: c.event.scheduledDate,
    time: c.event.scheduledTime,
    timeZone: c.event.timeZone,
    address: c.event.address,
    deadline: c.event.rsvpDeadlineLocal,
    deadlineAtUTC: c.event.deadlineAtUTC,
    status: c.event.status,
  };
}
const groupDTO = (doc: DocumentData, id: string) => ({
  id,
  label: doc.label,
  version: doc.version,
  revoked: doc.revoked,
  token: doc.token,
  response: doc.response,
  responseVersion: doc.responseVersion,
  lastReason: doc.lastReason || '',
});
const cardDTO = (card: DocumentData | undefined) =>
  card
    ? {
        version: card.version,
        published: card.published,
        title: card.title,
        message: card.message,
        contact: card.contact,
        publicToken: card.publicToken,
        publicRevoked: card.publicRevoked,
      }
    : null;

export async function mutateInvitations(uid: string, body: Record<string, unknown>) {
  if (
    typeof body.action !== 'string' ||
    ![
      'dashboard',
      'publishCard',
      'withdrawCard',
      'rotatePublic',
      'revokePublic',
      'createGroup',
      'rotateGroup',
      'revokeGroup',
      'recordResponse',
    ].includes(body.action)
  )
    throw new ApiError(400, 'Thao tác thiệp không hợp lệ.');
  const clanId = id(body.clanId),
    eventId = id(body.eventId);
  const newToken = randomBytes(32).toString('hex');
  return store.runTransaction(
    async (tx) => {
      const c = await context(tx, clanId, eventId, uid);
      if (!c.manager)
        throw new ApiError(
          403,
          'Chỉ quản trị viên, chủ sự hoặc người đang được ủy quyền được quản lý thiệp này.',
        );
      const action = body.action;
      if (action === 'dashboard') {
        const groups = await tx.get(
          store.collection(c.base + 'invitationGroups').where('eventId', '==', eventId),
        );
        const rows = groups.docs.map((d) => groupDTO(d.data(), d.id));
        return {
          card: cardDTO(c.card),
          groups: rows,
          totals: attendanceTotals(rows as { response: AttendanceResponse }[]),
          eventVersion: c.event.version,
          expiresAtMs: expiry(c),
        };
      }
      if (c.event.version !== body.eventVersion)
        throw new ApiError(409, 'Sự kiện đã thay đổi. Tải lại trước khi quản lý thiệp.');
      if (action === 'publishCard') {
        open(c);
        version(c.card, body.version);
        if (body.consent !== true)
          throw new ApiError(400, 'Cần xác nhận cho phép người có link xem nội dung thiệp.');
        if (expiry(c) <= Date.now()) throw new ApiError(409, 'Buổi giỗ đã quá hạn link khách.');
        const title = text(body.title, 2, 120),
          message = text(body.message, 0, 3000),
          contact = text(body.contact, 0, 200);
        const token = c.card && !c.card.publicRevoked ? c.card.publicToken : newToken;
        if (token === newToken)
          tx.create(store.doc('guestTokens/' + hash(token)), {
            clanId,
            eventId,
            kind: 'view',
            groupId: '',
            revoked: false,
          });
        tx.set(c.cardRef, {
          title,
          message,
          contact,
          published: true,
          publicToken: token,
          publicHash: hash(token),
          publicRevoked: false,
          version: (c.card?.version || 0) + 1,
          updatedBy: uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'published' };
      }
      if (action === 'withdrawCard' || action === 'rotatePublic' || action === 'revokePublic') {
        if (!c.card) throw new ApiError(404, 'Chưa có thiệp khách.');
        version(c.card, body.version);
        if (action === 'withdrawCard') {
          tx.update(c.cardRef, { published: false, version: c.card.version + 1 });
          return { status: 'withdrawn' };
        }
        if (action !== 'revokePublic') open(c);
        const old = store.doc('guestTokens/' + c.card.publicHash);
        await tx.get(old);
        tx.update(old, { revoked: true });
        if (action === 'rotatePublic') {
          tx.create(store.doc('guestTokens/' + hash(newToken)), {
            clanId,
            eventId,
            kind: 'view',
            groupId: '',
            revoked: false,
          });
          tx.update(c.cardRef, {
            publicToken: newToken,
            publicHash: hash(newToken),
            publicRevoked: false,
            version: c.card.version + 1,
          });
        } else tx.update(c.cardRef, { publicRevoked: true, version: c.card.version + 1 });
        return { status: 'updated' };
      }
      if (action === 'createGroup') {
        open(c);
        if (!c.card?.published || expiry(c) <= Date.now())
          throw new ApiError(409, 'Công bố thiệp khách còn hiệu lực trước khi tạo nhóm mời.');
        const groupId = text(body.operationId, 16, 100);
        id(groupId);
        const label = text(body.label, 2, 100);
        const ref = store.doc(c.base + 'invitationGroups/' + groupId),
          old = (await tx.get(ref)).data();
        if (old) {
          if (old.eventId !== eventId || old.createdBy !== uid || old.label !== label)
            throw new ApiError(409, 'Mã tạo nhóm đã dùng.');
          return { id: groupId, status: 'exists' };
        }
        tx.create(ref, {
          eventId,
          label,
          version: 1,
          revoked: false,
          token: newToken,
          tokenHash: hash(newToken),
          response: pending,
          responseVersion: 0,
          lastMutationId: '',
          lastMutationHash: '',
          lastReason: '',
          createdBy: uid,
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.create(store.doc('guestTokens/' + hash(newToken)), {
          clanId,
          eventId,
          kind: 'reply',
          groupId,
          revoked: false,
        });
        return { id: groupId, status: 'created' };
      }
      if (['rotateGroup', 'revokeGroup', 'recordResponse'].includes(String(action))) {
        const groupId = id(body.groupId),
          ref = store.doc(c.base + 'invitationGroups/' + groupId);
        const group = (await tx.get(ref)).data();
        if (!group || group.eventId !== eventId)
          throw new ApiError(404, 'Không tìm thấy nhóm khách của sự kiện này.');
        version(group, body.version);
        if (action !== 'revokeGroup') open(c);
        if (action === 'recordResponse') {
          const value = response(body),
            operationId = text(body.operationId, 16, 100);
          const reason = text(body.reason, 0, 500);
          if (Date.now() >= Date.parse(c.event.deadlineAtUTC) && reason.length < 5)
            throw new ApiError(400, 'Đã qua hạn phản hồi; người quản lý cần ghi lý do từ 5 ký tự.');
          const fingerprint = hash(
            JSON.stringify({
              value,
              reason,
              eventVersion: body.eventVersion,
              responseVersion: body.responseVersion,
              uid,
            }),
          );
          if (group.lastMutationId === operationId) {
            if (group.lastMutationHash !== fingerprint)
              throw new ApiError(409, 'Mã gửi đã được dùng cho nội dung khác.');
            return { status: 'saved' };
          }
          if (group.responseVersion !== body.responseVersion)
            throw new ApiError(409, 'Phản hồi đã thay đổi. Tải cập nhật trước khi ghi thay.');
          tx.update(ref, {
            response: value,
            responseVersion: group.responseVersion + 1,
            lastReason: reason,
            lastActor: uid,
            lastMutationId: operationId,
            lastMutationHash: fingerprint,
            respondedAt: FieldValue.serverTimestamp(),
          });
          return { status: 'saved' };
        }
        const old = store.doc('guestTokens/' + group.tokenHash);
        await tx.get(old);
        tx.update(old, { revoked: true });
        if (action === 'rotateGroup') {
          if (expiry(c) <= Date.now()) throw new ApiError(409, 'Buổi giỗ đã quá hạn link khách.');
          tx.create(store.doc('guestTokens/' + hash(newToken)), {
            clanId,
            eventId,
            kind: 'reply',
            groupId,
            revoked: false,
          });
          tx.update(ref, {
            token: newToken,
            tokenHash: hash(newToken),
            revoked: false,
            version: group.version + 1,
          });
        } else tx.update(ref, { revoked: true, version: group.version + 1 });
        return { status: 'updated' };
      }
      throw new ApiError(400, 'Thao tác thiệp không hợp lệ.');
    },
    { maxAttempts: 5 },
  );
}

// A bounded local budget. Production needs a shared limiter before Internet rollout.
let budgetStart = 0,
  total = 0;
const budgets = new Map<string, number>();
function budget(token: unknown) {
  const now = Date.now();
  if (now - budgetStart >= 60000) {
    budgetStart = now;
    total = 0;
    budgets.clear();
  }
  const key = hash(typeof token === 'string' ? token : 'invalid');
  const count = (budgets.get(key) || 0) + 1;
  if (++total > 600 || count > 120 || (!budgets.has(key) && budgets.size >= 1024))
    throw new ApiError(429, 'Có nhiều lượt truy cập. Vui lòng chờ một phút rồi thử lại.');
  budgets.set(key, count);
}
async function guestContext(tx: Transaction, raw: unknown) {
  const key = tokenHash(raw),
    token = (await tx.get(store.doc('guestTokens/' + key))).data();
  if (!token || token.revoked) throw unavailable();
  let c: Context;
  try {
    c = await context(tx, id(token.clanId), id(token.eventId));
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 404)) throw unavailable();
    throw e;
  }
  const groupSnap =
    token.kind === 'reply'
      ? await tx.get(store.doc(c.base + 'invitationGroups/' + id(token.groupId)))
      : null;
  const group = groupSnap?.data();
  if (
    !c.card?.published ||
    !Number.isFinite(expiry(c)) ||
    expiry(c) <= Date.now() ||
    (token.kind === 'view'
      ? c.card.publicRevoked || c.card.publicHash !== key
      : !group || group.revoked || group.tokenHash !== key || group.eventId !== token.eventId)
  )
    throw unavailable();
  if (
    c.event.status !== 'cancelled' &&
    (!['published', 'completed'].includes(c.event.status) || !confirmed(c))
  )
    throw new ApiError(
      409,
      'Thiệp đang tạm đóng để gia đình xác nhận lại thông tin. Vui lòng quay lại sau.',
    );
  return { c, token, group, groupRef: groupSnap?.ref };
}
export async function previewGuest(body: Record<string, unknown>) {
  budget(body.token);
  return store.runTransaction(async (tx) => {
    const { c, group } = await guestContext(tx, body.token);
    const cancelled = c.event.status === 'cancelled';
    return {
      state: cancelled ? 'cancelled' : 'open',
      title: c.card!.title,
      card: cancelled ? null : publicCard(c),
      group:
        cancelled || !group
          ? null
          : {
              label: group.label,
              response: group.response,
              responseVersion: group.responseVersion,
            },
      canRespond:
        !cancelled &&
        !!group &&
        c.event.status === 'published' &&
        Date.now() < Date.parse(c.event.deadlineAtUTC),
      eventVersion: c.event.version,
      cardVersion: c.card!.version,
      expiresAtMs: expiry(c),
    };
  });
}
export async function respondGuest(body: Record<string, unknown>) {
  budget(body.token);
  const value = response(body),
    operationId = text(body.operationId, 16, 100);
  return store.runTransaction(
    async (tx) => {
      const { c, group, groupRef } = await guestContext(tx, body.token);
      if (!group || !groupRef)
        throw new ApiError(
          403,
          'Link xem chung không nhận phản hồi. Hãy xin link riêng của gia đình bạn.',
        );
      open(c);
      if (c.event.version !== body.eventVersion || c.card!.version !== body.cardVersion)
        throw new ApiError(
          409,
          'Nội dung thiệp hoặc lịch đã thay đổi. Tải thiệp mới và kiểm tra trước khi gửi.',
        );
      const fingerprint = hash(
        JSON.stringify({
          value,
          eventVersion: body.eventVersion,
          cardVersion: body.cardVersion,
          responseVersion: body.responseVersion,
        }),
      );
      if (group.lastMutationId === operationId) {
        if (group.lastMutationHash !== fingerprint)
          throw new ApiError(409, 'Mã gửi đã dùng cho nội dung khác.');
        return { status: 'saved', responseVersion: group.responseVersion };
      }
      if (Date.now() >= Date.parse(c.event.deadlineAtUTC))
        throw new ApiError(409, 'Đã qua hạn phản hồi. Vui lòng liên hệ người tổ chức để cập nhật.');
      if (group.responseVersion !== body.responseVersion)
        throw new ApiError(
          409,
          'Một người trong nhóm đã cập nhật phản hồi. Tải bản mới trước khi sửa.',
        );
      tx.update(groupRef, {
        response: value,
        responseVersion: group.responseVersion + 1,
        lastMutationId: operationId,
        lastMutationHash: fingerprint,
        lastReason: '',
        lastActor: 'guest',
        respondedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'saved', responseVersion: group.responseVersion + 1 };
    },
    { maxAttempts: 5 },
  );
}

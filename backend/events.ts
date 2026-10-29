import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentData } from 'firebase-admin/firestore';
import { store, ApiError } from './service.ts';
import {
  solarToLunar,
  anniversaryCandidate,
  sameDate,
  validCivilISO,
  validateRule,
  type AnniversaryRule,
} from '../src/shared/domain/anniversary.ts';
import { eventTimes } from './event-time.ts';

function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(value))
    throw new ApiError(400, 'Mã đối tượng không hợp lệ.');
  return value;
}
function version(data: DocumentData | undefined, expected: unknown) {
  if (data ? expected !== data.version : expected !== null)
    throw new ApiError(
      409,
      'Thông tin đã thay đổi. Tải bản mới trước khi lưu; nội dung đang nhập được giữ lại.',
    );
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max)
    throw new ApiError(400, 'Nội dung không hợp lệ hoặc quá dài.');
  return value.trim();
}
export const memberEpoch = (m: DocumentData) =>
  String(m.joinedAt?.toMillis?.() ?? 0) + ':' + String(m.invitationId ?? '');
export async function mutateEvents(uid: string, body: Record<string, unknown>) {
  const clanId = id(body.clanId);
  const clan = store.doc('clans/' + clanId);
  const auditRef = clan.collection('stewardChanges').doc();
  return store.runTransaction(
    async (tx) => {
      const actor = await tx.get(store.doc('memberships/' + clanId + '_' + uid));
      if (!actor.exists) throw new ApiError(403, 'Bạn không còn quyền truy cập dòng họ này.');
      const admin = actor.data()!.role === 'admin';
      const lock = clan.collection('genealogyMeta').doc('lock');
      const lockData = await tx.get(lock);
      const finish = (result: Record<string, unknown>) => {
        tx.set(lock, {
          version: (lockData.data()?.version || 0) + 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return result;
      };
      const action = body.action;
      const requestRef = clan
        .collection('delegations')
        .doc(action === 'respondDelegation' ? id(body.requestId) : '_unused');
      const request =
        action === 'respondDelegation' ? (await tx.get(requestRef)).data() : undefined;
      if (action === 'respondDelegation' && !request)
        throw new ApiError(404, 'Không tìm thấy yêu cầu.');
      const personId = id(request?.personId ?? body.personId);
      const personRef = clan.collection('people').doc(personId);
      const assignmentRef = clan.collection('assignments').doc(personId);
      const ruleRef = clan.collection('anniversaryRules').doc(personId);
      const [personSnap, assignmentSnap, ruleSnap] = await Promise.all([
        tx.get(personRef),
        tx.get(assignmentRef),
        tx.get(ruleRef),
      ]);
      const person = personSnap.data(),
        assignment = assignmentSnap.data(),
        rule = ruleSnap.data();
      if (!person || person.archived || person.lifeStatus !== 'deceased')
        throw new ApiError(409, 'Cần hồ sơ người đã khuất đang hoạt động.');
      const hostMember = assignment
        ? (await tx.get(store.doc('memberships/' + clanId + '_' + assignment.hostUid))).data()
        : undefined;
      const activeHost = !!hostMember && assignment?.hostEpoch === memberEpoch(hostMember);
      const host = activeHost && assignment!.hostUid === uid;
      const requireManager = () => {
        if (!admin && !host)
          throw new ApiError(403, 'Chỉ quản trị viên hoặc chủ sự hiện tại được thực hiện.');
      };
      const audit = (kind: string, fromUid: string, toUid: string, eventId = '') =>
        tx.set(auditRef, {
          kind,
          personId,
          eventId,
          fromUid,
          toUid,
          actorUid: uid,
          at: FieldValue.serverTimestamp(),
        });
      if (action === 'assignHost') {
        if (!admin) throw new ApiError(403, 'Chỉ quản trị viên được phân công chủ sự.');
        version(assignment, body.version);
        const toUid = id(body.toUid);
        const target = (await tx.get(store.doc('memberships/' + clanId + '_' + toUid))).data();
        if (!target) throw new ApiError(400, 'Người nhận phải còn là thành viên dòng họ.');
        const affectedEvents = await tx.get(
          clan.collection('events').where('personId', '==', personId),
        );
        for (const doc of affectedEvents.docs)
          if (!['completed', 'cancelled'].includes(doc.data().status))
            tx.update(doc.ref, {
              delegateUid: '',
              delegateEpoch: '',
              delegateAssignmentVersion: 0,
              version: doc.data().version + 1,
              reminderRevision: doc.data().reminderRevision + 1,
              reminderRevisionAt: FieldValue.serverTimestamp(),
            });
        tx.set(assignmentRef, {
          hostUid: toUid,
          hostEpoch: memberEpoch(target),
          version: (assignment?.version || 0) + 1,
          updatedBy: uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        audit('assign', assignment?.hostUid || '', toUid);
        return finish({ id: personId });
      }
      if (action === 'saveRule') {
        requireManager();
        version(rule, body.version);
        let fields;
        try {
          fields = validateRule(body.rule);
        } catch (e) {
          throw new ApiError(400, (e as Error).message);
        }
        const events = await tx.get(clan.collection('events').where('personId', '==', personId));
        tx.set(ruleRef, {
          ...fields,
          sourceDate: person.death,
          version: (rule?.version || 0) + 1,
          updatedBy: uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        // Withdraw published dates until a responsible person confirms the revised rule.
        for (const doc of events.docs)
          if (!['completed', 'cancelled'].includes(doc.data().status))
            tx.update(doc.ref, {
              dateConfirmed: false,
              status: 'draft',
              version: doc.data().version + 1,
              reminderRevision: doc.data().reminderRevision + 1,
              reminderRevisionAt: FieldValue.serverTimestamp(),
            });
        return finish({ id: personId });
      }
      if (action === 'createEvent') {
        requireManager();
        const year = body.year;
        if (!Number.isInteger(year) || Number(year) < 1900 || Number(year) > 2099)
          throw new ApiError(400, 'Chọn năm lịch giỗ từ 1900 đến 2099.');
        if (!rule || !sameDate(rule.sourceDate, person.death))
          throw new ApiError(409, 'Lưu quy tắc theo ngày mất hiện tại trước khi tạo sự kiện.');
        const ref = clan.collection('events').doc(personId + '_' + year);
        const old = await tx.get(ref);
        if (old.exists)
          throw new ApiError(
            409,
            'Năm này đã có sự kiện; mở bản hiện có để chỉnh sửa hoặc mở lại.',
          );
        const candidate = anniversaryCandidate(rule as AnniversaryRule, Number(year));
        tx.create(ref, {
          personId,
          personName: person.name,
          year,
          status: 'draft',
          version: 1,
          reminderRevision: 1,
          reminderRevisionAt: FieldValue.serverTimestamp(),
          anniversaryDate: candidate.date || '',
          dateConfirmed: false,
          confirmationNote: '',
          sourceDate: person.death,
          ruleVersion: rule.version,
          scheduledDate: candidate.date || '',
          scheduledTime: '',
          timeZone: 'Asia/Ho_Chi_Minh',
          startsAtUTC: '',
          rsvpDeadlineLocal: '',
          deadlineAtUTC: '',
          address: '',
          invitationText: '',
          delegateUid: '',
          delegateEpoch: '',
          delegateAssignmentVersion: 0,
          updatedBy: uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return finish({ id: ref.id });
      }
      if (action === 'respondDelegation') {
        version(request, body.version);
        if (request!.status !== 'pending') throw new ApiError(409, 'Yêu cầu đã được xử lý.');
        const decision = body.decision;
        if (!['accept', 'reject', 'cancel'].includes(String(decision)))
          throw new ApiError(400, 'Lựa chọn không hợp lệ.');
        if (decision === 'cancel' ? !admin && uid !== request!.fromUid : uid !== request!.toUid)
          throw new ApiError(403, 'Bạn không được xử lý yêu cầu này.');
        const recipient = (
          await tx.get(store.doc('memberships/' + clanId + '_' + request!.toUid))
        ).data();
        const sender = (
          await tx.get(store.doc('memberships/' + clanId + '_' + request!.fromUid))
        ).data();
        const eventRef =
          request!.scope === 'event' ? clan.collection('events').doc(id(request!.eventId)) : null;
        const event = eventRef ? (await tx.get(eventRef)).data() : undefined;
        let status =
          decision === 'cancel' ? 'cancelled' : decision === 'reject' ? 'rejected' : 'accepted';
        let resolution = '';
        if (request!.expiresAtMs <= Date.now()) {
          status = 'expired';
          resolution = 'Yêu cầu đã hết hạn 7 ngày.';
        } else if (
          !sender ||
          !recipient ||
          !activeHost ||
          assignment!.hostUid !== request!.fromUid ||
          memberEpoch(sender) !== request!.fromEpoch ||
          memberEpoch(recipient) !== request!.toEpoch ||
          assignment!.version !== request!.assignmentVersion ||
          (eventRef &&
            (!event ||
              ['cancelled', 'completed'].includes(event.status) ||
              event.version !== request!.eventVersion))
        ) {
          status = 'cancelled';
          resolution = 'Phân công, sự kiện hoặc tư cách thành viên đã thay đổi.';
        }
        const affectedEvents =
          request!.scope === 'permanent' && status === 'accepted'
            ? await tx.get(clan.collection('events').where('personId', '==', personId))
            : null;
        for (const doc of affectedEvents?.docs || [])
          if (!['completed', 'cancelled'].includes(doc.data().status))
            tx.update(doc.ref, {
              delegateUid: '',
              delegateEpoch: '',
              delegateAssignmentVersion: 0,
              version: doc.data().version + 1,
              reminderRevision: doc.data().reminderRevision + 1,
              reminderRevisionAt: FieldValue.serverTimestamp(),
            });
        tx.update(requestRef, {
          status,
          resolution,
          version: request!.version + 1,
          resolvedAt: FieldValue.serverTimestamp(),
        });
        if (status === 'accepted') {
          if (eventRef) {
            tx.update(eventRef, {
              delegateUid: request!.toUid,
              delegateEpoch: memberEpoch(recipient!),
              delegateAssignmentVersion: assignment!.version,
              version: event!.version + 1,
              reminderRevision: event!.reminderRevision + 1,
              reminderRevisionAt: FieldValue.serverTimestamp(),
            });
          } else {
            tx.update(assignmentRef, {
              hostUid: request!.toUid,
              hostEpoch: memberEpoch(recipient!),
              version: assignment!.version + 1,
              updatedBy: uid,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          audit(
            request!.scope === 'event' ? 'delegate-accepted' : 'transfer-accepted',
            request!.fromUid,
            request!.toUid,
            request!.eventId,
          );
        }
        return finish({ id: requestRef.id, status, notice: resolution });
      }
      let eventRef = null;
      let event: DocumentData | undefined;
      if (
        ['saveEvent', 'transitionEvent', 'revokeDelegate'].includes(String(action)) ||
        (action === 'requestDelegation' && body.scope === 'event')
      ) {
        eventRef = clan.collection('events').doc(id(body.eventId));
        event = (await tx.get(eventRef)).data();
        if (!event || event.personId !== personId)
          throw new ApiError(404, 'Không tìm thấy sự kiện của người này.');
      }
      if (action === 'requestDelegation') {
        // Administrators can assign directly; only the permanent host can offer their responsibility.
        if (!host) throw new ApiError(403, 'Chỉ chủ sự hiện tại được đề nghị chuyển giao.');
        if (body.scope !== 'permanent' && body.scope !== 'event')
          throw new ApiError(400, 'Phạm vi không hợp lệ.');
        const toUid = id(body.toUid);
        if (toUid === uid) throw new ApiError(400, 'Chọn một người thân khác.');
        const target = (await tx.get(store.doc('memberships/' + clanId + '_' + toUid))).data();
        if (!target) throw new ApiError(400, 'Người nhận không còn là thành viên.');
        if (event && ['completed', 'cancelled'].includes(event.status))
          throw new ApiError(409, 'Sự kiện đã kết thúc.');
        const ref = clan
          .collection('delegations')
          .doc(body.scope === 'permanent' ? 'permanent_' + personId : 'event_' + eventRef!.id);
        const old = (await tx.get(ref)).data();
        if (
          old?.status === 'pending' &&
          old.expiresAtMs > Date.now() &&
          old.assignmentVersion === assignment!.version &&
          (body.scope !== 'event' || old.eventVersion === event!.version)
        ) {
          const oldTarget = (
            await tx.get(store.doc('memberships/' + clanId + '_' + old.toUid))
          ).data();
          if (oldTarget && old.toEpoch === memberEpoch(oldTarget))
            throw new ApiError(409, 'Đã có một yêu cầu chờ; hủy trước khi gửi yêu cầu khác.');
        }
        tx.set(ref, {
          scope: body.scope,
          personId,
          eventId: eventRef?.id || '',
          fromUid: uid,
          toUid,
          fromEpoch: memberEpoch(actor.data()!),
          toEpoch: memberEpoch(target),
          assignmentVersion: assignment!.version,
          eventVersion: event?.version || 0,
          status: 'pending',
          resolution: '',
          expiresAtMs: Date.now() + 7 * 86400000,
          version: (old?.version || 0) + 1,
          createdAt: FieldValue.serverTimestamp(),
        });
        return finish({ id: ref.id });
      }
      if (event && eventRef) {
        const activeDelegate =
          event.delegateUid === uid &&
          event.delegateEpoch === memberEpoch(actor.data()!) &&
          activeHost &&
          event.delegateAssignmentVersion === assignment!.version;
        if (!admin && !host && !activeDelegate)
          throw new ApiError(403, 'Bạn không có quyền quản lý sự kiện này.');
        version(event, body.version);
        if (action === 'revokeDelegate') {
          requireManager();
          tx.update(eventRef, {
            delegateUid: '',
            delegateEpoch: '',
            delegateAssignmentVersion: 0,
            version: event.version + 1,
            reminderRevision: event.reminderRevision + 1,
            reminderRevisionAt: FieldValue.serverTimestamp(),
          });
          audit('delegate-revoked', event.delegateUid, '', eventRef.id);
          return finish({ id: eventRef.id });
        }
        if (event.status === 'completed')
          throw new ApiError(409, 'Sự kiện đã hoàn tất, không thể sửa.');
        if (action === 'saveEvent') {
          if (event.status === 'cancelled')
            throw new ApiError(409, 'Mở lại bản nháp trước khi sửa.');
          if (!rule || !sameDate(rule.sourceDate, person.death))
            throw new ApiError(409, 'Ngày mất đã đổi; chủ sự cần lưu lại quy tắc.');
          version(rule, body.ruleVersion);
          const anniversaryDate = text(body.anniversaryDate, 10);
          const confirmationNote = text(body.confirmationNote, 500);
          const scheduledDate = text(body.scheduledDate, 10),
            scheduledTime = text(body.scheduledTime, 5);
          const timeZone = text(body.timeZone, 80),
            rsvpDeadlineLocal = text(body.rsvpDeadlineLocal, 16);
          const address = text(body.address, 500),
            invitationText = text(body.invitationText, 3000);
          if (typeof body.dateConfirmed !== 'boolean')
            throw new ApiError(400, 'Xác nhận ngày chưa hợp lệ.');
          if (anniversaryDate && !validCivilISO(anniversaryDate))
            throw new ApiError(400, 'Ngày giỗ cần là ngày dương lịch hợp lệ.');
          if (body.dateConfirmed && !anniversaryDate)
            throw new ApiError(400, 'Cần ngày giỗ trước khi xác nhận.');
          const candidate = anniversaryCandidate(rule as AnniversaryRule, event.year);
          if (
            body.dateConfirmed &&
            anniversaryDate !== candidate.date &&
            confirmationNote.length < 5
          )
            throw new ApiError(
              400,
              'Ngày xác nhận khác ngày tính được hoặc còn thiếu dữ liệu: ghi lý do từ 5 ký tự.',
            );
          // Annual confirmation belongs to this calendar year, not a different year's ceremony.
          if (
            body.dateConfirmed &&
            rule.calendar === 'solar' &&
            Number(anniversaryDate.slice(0, 4)) !== event.year
          )
            throw new ApiError(400, 'Ngày giỗ xác nhận phải thuộc năm dương lịch đã chọn.');
          if (body.dateConfirmed && rule.calendar === 'lunar') {
            const [y, m, d] = anniversaryDate.split('-').map(Number);
            const lunar = solarToLunar({ year: y, month: m, day: d });
            if (!lunar || lunar.year !== event.year)
              throw new ApiError(400, 'Ngày giỗ xác nhận phải thuộc năm âm lịch đã chọn.');
          }
          const times = eventTimes(scheduledDate, scheduledTime, timeZone, rsvpDeadlineLocal);
          if (
            event.status === 'published' &&
            (!body.dateConfirmed || !times.startsAtUTC || !times.deadlineAtUTC || !address)
          )
            throw new ApiError(
              409,
              'Bản công bố cần ngày đã xác nhận, giờ, địa điểm và hạn phản hồi. Chuyển về nháp nếu chưa đủ.',
            );
          tx.update(eventRef, {
            anniversaryDate,
            confirmationNote,
            dateConfirmed: body.dateConfirmed,
            sourceDate: person.death,
            ruleVersion: rule.version,
            scheduledDate,
            scheduledTime,
            timeZone,
            rsvpDeadlineLocal,
            address,
            invitationText,
            ...times,
            version: event.version + 1,
            reminderRevision: event.reminderRevision + 1,
            reminderRevisionAt: FieldValue.serverTimestamp(),
            updatedBy: uid,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return finish({ id: eventRef.id });
        }
        if (action === 'transitionEvent') {
          const status = body.status;
          const allowed: Record<string, string[]> = {
            draft: ['published', 'cancelled'],
            published: ['draft', 'cancelled', 'completed'],
            cancelled: ['draft'],
          };
          if (!allowed[event.status]?.includes(String(status)))
            throw new ApiError(409, 'Chuyển trạng thái không hợp lệ.');
          if (status === 'published') {
            if (!activeHost)
              throw new ApiError(
                409,
                'Chủ sự không còn hoạt động; quản trị viên cần phân công lại.',
              );
            if (
              !rule ||
              event.ruleVersion !== rule.version ||
              !sameDate(event.sourceDate, person.death) ||
              !sameDate(rule.sourceDate, person.death) ||
              !event.dateConfirmed ||
              !event.startsAtUTC ||
              !event.deadlineAtUTC ||
              !event.address
            )
              throw new ApiError(
                409,
                'Cần xác nhận ngày hiện tại, giờ tổ chức, địa điểm và hạn phản hồi trước khi công bố.',
              );
          }
          tx.update(eventRef, {
            status,
            version: event.version + 1,
            reminderRevision: event.reminderRevision + 1,
            reminderRevisionAt: FieldValue.serverTimestamp(),
            ...(['cancelled', 'completed'].includes(String(status))
              ? { delegateUid: '', delegateEpoch: '', delegateAssignmentVersion: 0 }
              : {}),
            ...(event.status === 'cancelled' ? { dateConfirmed: false } : {}),
            updatedBy: uid,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return finish({ id: eventRef.id });
        }
      }
      throw new ApiError(400, 'Thao tác lịch giỗ không được hỗ trợ.');
    },
    { maxAttempts: 5 },
  );
}

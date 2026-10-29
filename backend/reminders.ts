import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import { store, ApiError } from './service.ts';
import { memberEpoch } from './events.ts';
import { sameDate } from '../src/shared/domain/anniversary.ts';
import { reminderMilestones, dueReminder } from '../src/shared/domain/reminders.ts';
const base = (clanId: string) => 'clans/' + clanId + '/';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const id = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(value))
    throw new ApiError(400, 'Mã gia phả không hợp lệ.');
  return value;
};
async function current(tx: Transaction, clanId: string, eventId: string, uid: string) {
  const b = base(clanId);
  const [memberSnap, eventSnap] = await Promise.all([
    tx.get(store.doc('memberships/' + clanId + '_' + uid)),
    tx.get(store.doc(b + 'events/' + eventId)),
  ]);
  const member = memberSnap.data(),
    event = eventSnap.data();
  if (!member || member.uid !== uid || member.clanId !== clanId || !event) return null;
  const [personSnap, ruleSnap, assignmentSnap] = await Promise.all(
    ['people/', 'anniversaryRules/', 'assignments/'].map((path) =>
      tx.get(store.doc(b + path + id(event.personId))),
    ),
  );
  const person = personSnap.data(),
    rule = ruleSnap.data(),
    assignment = assignmentSnap.data();
  const host = assignment
    ? (await tx.get(store.doc('memberships/' + clanId + '_' + id(assignment.hostUid)))).data()
    : undefined;
  const valid =
    event.status === 'published' &&
    person &&
    !person.archived &&
    person.lifeStatus === 'deceased' &&
    rule &&
    host &&
    assignment?.hostEpoch === memberEpoch(host) &&
    event.dateConfirmed &&
    event.ruleVersion === rule.version &&
    sameDate(event.sourceDate, person.death) &&
    sameDate(rule.sourceDate, person.death) &&
    Number.isFinite(Date.parse(event.startsAtUTC));
  return { member, event, valid: !!valid };
}
function since(event: DocumentData) {
  return event.reminderRevisionAt?.toMillis?.() ?? event.updatedAt?.toMillis?.() ?? NaN;
}
async function processJob(
  clanId: string,
  eventId: string,
  uid: string,
  offset: number,
  revision: number,
  epoch: string,
  now: number,
  fail?: () => Promise<void>,
) {
  const key = hash([clanId, eventId, revision, offset, uid, epoch].join('|')),
    ref = store.doc(base(clanId) + 'reminderJobs/' + key);
  const lease = randomBytes(16).toString('hex');
  const claimed = await store.runTransaction(async (tx) => {
    const state = await current(tx, clanId, eventId, uid),
      old = (await tx.get(ref)).data();
    const valid =
      state?.valid &&
      state.event.reminderRevision === revision &&
      memberEpoch(state.member) === epoch;
    let dueAtMs = old?.dueAtMs ?? NaN;
    if (valid) {
      try {
        dueAtMs =
          reminderMilestones(state.event.scheduledDate, state.event.timeZone).find(
            (m) => m.offset === offset,
          )?.dueAtMs ?? NaN;
      } catch {
        dueAtMs = NaN;
      }
    }
    if (
      !valid ||
      !dueReminder(
        dueAtMs,
        state ? since(state.event) : NaN,
        state ? Date.parse(state.event.startsAtUTC) : NaN,
        now,
      )
    ) {
      if (old && !['delivered', 'cancelled', 'failed'].includes(old.status))
        tx.update(ref, { status: 'cancelled', reason: 'stale-or-expired', leaseUntilMs: 0 });
      return false;
    }
    if (
      old?.status === 'delivered' ||
      old?.status === 'cancelled' ||
      old?.status === 'failed' ||
      (old?.status === 'processing' && old.leaseUntilMs > now) ||
      (old?.status === 'retry' && old.nextAttemptAtMs > now)
    )
      return false;
    if ((old?.attempts || 0) >= 3) {
      tx.update(ref, { status: 'failed', lastError: 'retry-limit', leaseUntilMs: 0 });
      return false;
    }
    tx.set(ref, {
      eventId,
      uid,
      epoch,
      revision,
      offset,
      dueAtMs,
      status: 'processing',
      attempts: (old?.attempts || 0) + 1,
      lease,
      leaseUntilMs: now + 60000,
      nextAttemptAtMs: now,
      lastError: '',
      createdAt: old?.createdAt || FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!claimed) return 'skipped';
  try {
    if (fail) await fail();
    return await store.runTransaction(async (tx) => {
      const job = (await tx.get(ref)).data(),
        state = await current(tx, clanId, eventId, uid);
      const inbox = store.doc(base(clanId) + 'reminderInbox/' + key),
        old = await tx.get(inbox);
      if (job?.lease !== lease || job.status !== 'processing') return 'skipped';
      if (
        !state?.valid ||
        state.event.reminderRevision !== revision ||
        memberEpoch(state.member) !== epoch ||
        !dueReminder(job.dueAtMs, since(state.event), Date.parse(state.event.startsAtUTC), now)
      ) {
        tx.update(ref, { status: 'cancelled', reason: 'changed-before-delivery', leaseUntilMs: 0 });
        return 'cancelled';
      }
      if (!old.exists)
        tx.create(inbox, {
          uid,
          epoch,
          eventId,
          revision,
          offset,
          dueAtMs: job.dueAtMs,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      tx.update(ref, {
        status: 'delivered',
        leaseUntilMs: 0,
        deliveredAt: FieldValue.serverTimestamp(),
      });
      return 'delivered';
    });
  } catch {
    await store.runTransaction(async (tx) => {
      const job = (await tx.get(ref)).data();
      if (job?.lease === lease && job.status === 'processing')
        tx.update(ref, {
          status: job.attempts >= 3 ? 'failed' : 'retry',
          lastError: 'temporary-delivery-failure',
          leaseUntilMs: 0,
          nextAttemptAtMs: now + [60000, 300000, 900000][job.attempts - 1],
        });
    });
    return 'retry';
  }
}
export async function runReminderTick(
  options: { clanId?: string; now?: number; fail?: () => Promise<void> } = {},
) {
  const now = options.now ?? Date.now();
  const clans = options.clanId
    ? [{ id: id(options.clanId) }]
    : (await store.collection('clans').get()).docs;
  const counts = { delivered: 0, cancelled: 0, retry: 0, skipped: 0 };
  for (const clan of clans) {
    const b = base(clan.id);
    const [events, members, oldJobs] = await Promise.all([
      store
        .collection(b + 'events')
        .where('status', '==', 'published')
        .get(),
      store.collection('memberships').where('clanId', '==', clan.id).get(),
      store.collection(b + 'reminderJobs').get(),
    ]);
    const candidates = new Map<
      string,
      { eventId: string; uid: string; revision: number; epoch: string; offset: number }
    >();
    for (const eventDoc of events.docs) {
      const event = eventDoc.data();
      let milestones;
      try {
        milestones = reminderMilestones(event.scheduledDate, event.timeZone);
      } catch {
        continue;
      }
      for (const m of milestones)
        if (dueReminder(m.dueAtMs, since(event), Date.parse(event.startsAtUTC), now))
          for (const member of members.docs) {
            const epoch = memberEpoch(member.data());
            candidates.set(
              [eventDoc.id, member.id, m.offset, event.reminderRevision, epoch].join('|'),
              {
                eventId: eventDoc.id,
                uid: member.data().uid,
                revision: event.reminderRevision,
                epoch,
                offset: m.offset,
              },
            );
          }
    }
    for (const doc of oldJobs.docs) {
      const j = doc.data();
      if (['retry', 'processing'].includes(j.status))
        candidates.set('retry:' + doc.id, {
          eventId: j.eventId,
          uid: j.uid,
          revision: j.revision,
          epoch: j.epoch,
          offset: j.offset,
        });
    }
    for (const c of candidates.values()) {
      const result = await processJob(
        clan.id,
        c.eventId,
        c.uid,
        c.offset,
        c.revision,
        c.epoch,
        now,
        options.fail,
      );
      counts[result]++;
    }
    await store.doc(b + 'reminderMeta/status').set({ lastScanAtMs: now });
  }
  return counts;
}
export async function mutateReminders(uid: string, body: Record<string, unknown>) {
  const clanId = id(body.clanId),
    b = base(clanId);
  const member = await store.runTransaction(async (tx) => {
    const value = (await tx.get(store.doc('memberships/' + clanId + '_' + uid))).data();
    if (!value || value.uid !== uid || value.clanId !== clanId)
      throw new ApiError(403, 'Bạn không còn quyền truy cập gia phả.');
    return value;
  });
  if (body.action === 'run') {
    if (member.role !== 'admin') throw new ApiError(403, 'Chỉ quản trị viên chạy quét nhắc local.');
    return runReminderTick({ clanId });
  }
  return store.runTransaction(async (tx) => {
    const actor = (await tx.get(store.doc('memberships/' + clanId + '_' + uid))).data();
    if (!actor || memberEpoch(actor) !== memberEpoch(member))
      throw new ApiError(403, 'Tư cách thành viên đã thay đổi.');
    if (body.action === 'status') {
      if (actor.role !== 'admin')
        throw new ApiError(403, 'Chỉ quản trị viên xem tình trạng worker.');
      const [jobs, meta] = await Promise.all([
        tx.get(store.collection(b + 'reminderJobs')),
        tx.get(store.doc(b + 'reminderMeta/status')),
      ]);
      const counts: Record<string, number> = {
        processing: 0,
        retry: 0,
        failed: 0,
        delivered: 0,
        cancelled: 0,
      };
      for (const d of jobs.docs) counts[d.data().status] = (counts[d.data().status] || 0) + 1;
      return { counts, lastScanAtMs: meta.data()?.lastScanAtMs ?? null, mode: 'local-inbox' };
    }
    if (body.action === 'read') {
      const ref = store.doc(b + 'reminderInbox/' + id(body.id)),
        inbox = (await tx.get(ref)).data();
      if (!inbox || inbox.uid !== uid || inbox.epoch !== memberEpoch(actor))
        throw new ApiError(403, 'Không được sửa lời nhắc này.');
      tx.update(ref, { read: true });
      return { status: 'read' };
    }
    if (body.action !== 'list') throw new ApiError(400, 'Thao tác nhắc giỗ không hợp lệ.');
    const rows = await tx.get(store.collection(b + 'reminderInbox').where('uid', '==', uid));
    const cache = new Map<string, Awaited<ReturnType<typeof current>>>(),
      items = [];
    for (const doc of rows.docs) {
      const item = doc.data();
      if (item.epoch !== memberEpoch(actor)) continue;
      if (!cache.has(item.eventId))
        cache.set(item.eventId, await current(tx, clanId, item.eventId, uid));
      const state = cache.get(item.eventId);
      if (state?.valid && state.event.reminderRevision === item.revision)
        items.push({
          id: doc.id,
          eventId: item.eventId,
          offset: item.offset,
          dueAtMs: item.dueAtMs,
          read: item.read,
          title: 'Giỗ ' + state.event.personName,
          date: state.event.scheduledDate,
          time: state.event.scheduledTime,
          timeZone: state.event.timeZone,
        });
    }
    return { items: items.sort((a, b) => b.dueAtMs - a.dueAtMs).slice(0, 50) };
  });
}
export function startReminderWorker() {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void runReminderTick()
      .catch(() => console.warn('Reminder local worker: chưa kết nối được Emulator.'))
      .finally(() => {
        running = false;
      });
  }, 60000);
  timer.unref();
  return () => clearInterval(timer);
}

import { sameDate } from '../src/shared/domain/anniversary.ts';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { runtime } from './config.ts';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type DocumentData } from 'firebase-admin/firestore';
import {
  createsAncestryCycle,
  validatePerson,
  validateRelationship,
  type FamilyRelationship,
} from '../src/shared/domain/genealogy.ts';
if (runtime.local) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}
function resolveCredential() {
  if (runtime.local) return undefined;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT không đúng định dạng JSON.');
    }
  }
  return applicationDefault();
}
const appCredential = resolveCredential();
const app = initializeApp(
  {
    projectId: runtime.projectId,
    ...(appCredential ? { credential: appCredential } : {}),
  },
  'genealogy-local',
);
export const adminAuth = getAuth(app);
export const store = getFirestore(app);
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const validId = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(value))
    throw new ApiError(400, 'Mã đối tượng không hợp lệ.');
  return value;
};
const expectVersion = (data: DocumentData, version: unknown) => {
  if (!Number.isInteger(version) || version !== data.version)
    throw new ApiError(
      409,
      'Thông tin đã được người khác thay đổi. Hãy tải bản mới trước khi lưu lại.',
    );
};
export async function mutate(uid: string, body: Record<string, unknown>) {
  const clanId = validId(body.clanId);
  const clan = store.collection('clans').doc(clanId);
  const action = String(body.action);
  return store.runTransaction(
    async (tx) => {
      const membership = await tx.get(store.doc('memberships/' + clanId + '_' + uid));
      if (!membership.exists) throw new ApiError(403, 'Bạn không còn quyền truy cập dòng họ này.');
      const role = membership.data()!.role as string;
      const editor = role === 'admin' || role === 'editor';
      const admin = role === 'admin';
      const requireEditor = () => {
        if (!editor)
          throw new ApiError(403, 'Chỉ quản trị viên hoặc biên tập viên được sửa gia phả.');
      };
      const requireAdmin = () => {
        if (!admin) throw new ApiError(403, 'Chỉ quản trị viên được duyệt yêu cầu.');
      };
      const lock = clan.collection('genealogyMeta').doc('lock');
      const lockSnapshot = await tx.get(lock);
      const finish = (result: Record<string, unknown>) => {
        tx.set(lock, {
          version: (lockSnapshot.data()?.version || 0) + 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return result;
      };
      if (action === 'createPerson' || action === 'updatePerson') {
        requireEditor();
        let person;
        try {
          person = validatePerson(body.person);
        } catch (e) {
          throw new ApiError(400, (e as Error).message);
        }
        const id = validId(body.personId);
        const ref = clan.collection('people').doc(id);
        const existing = await tx.get(ref);
        if (action === 'createPerson' && existing.exists)
          throw new ApiError(409, 'Hồ sơ này đã được tạo. Hãy tải lại danh sách.');
        if (action === 'updatePerson') {
          if (!existing.exists) throw new ApiError(404, 'Không tìm thấy hồ sơ.');
          expectVersion(existing.data()!, body.version);
          if (existing.data()!.archived)
            throw new ApiError(409, 'Hãy khôi phục hồ sơ trước khi chỉnh sửa.');
        }
        // A contextual creation is atomic: no profile remains if linking fails.
        let newRelation: ReturnType<typeof validateRelationship> | undefined;
        if (body.initialRelation !== undefined && body.relationship !== undefined)
          throw new ApiError(400, 'Chỉ chọn một cách liên kết quan hệ ban đầu.');
        let relationship = body.relationship;
        if (body.initialRelation !== undefined) {
          const initial = body.initialRelation;
          if (!initial || typeof initial !== 'object' || Array.isArray(initial))
            throw new ApiError(400, 'Thông tin quan hệ ban đầu không hợp lệ.');
          const relation = initial as Record<string, unknown>;
          if (relation.role !== 'parent' && relation.role !== 'child' && relation.role !== 'spouse')
            throw new ApiError(400, 'Vai trò quan hệ không hợp lệ.');
          const targetId = validId(relation.targetId);
          relationship = {
            from: relation.role === 'child' ? targetId : id,
            to: relation.role === 'child' ? id : targetId,
            kind: relation.role === 'spouse' ? 'spouse' : 'parent',
            parentType: relation.parentType === undefined ? 'biological' : relation.parentType,
            status: relation.status === undefined ? 'current' : relation.status,
            source: '',
            verified: false,
          };
        }
        if (relationship !== undefined) {
          if (action !== 'createPerson')
            throw new ApiError(400, 'Chỉ nối quan hệ cùng lúc khi tạo hồ sơ mới.');
          try {
            newRelation = validateRelationship(relationship);
          } catch (e) {
            throw new ApiError(400, (e as Error).message);
          }
          if (newRelation.from !== id && newRelation.to !== id)
            throw new ApiError(400, 'Quan hệ phải liên kết hồ sơ đang tạo.');
          const targetId = validId(newRelation.from === id ? newRelation.to : newRelation.from);
          const target = await tx.get(clan.collection('people').doc(targetId));
          if (!target.exists || target.data()!.archived)
            throw new ApiError(400, 'Người liên kết phải đang hoạt động trong cùng dòng họ.');
          if (body.relationship !== undefined || body.targetVersion !== undefined)
            expectVersion(target.data()!, body.targetVersion);
          if (newRelation.kind === 'spouse' && newRelation.from > newRelation.to)
            [newRelation.from, newRelation.to] = [newRelation.to, newRelation.from];
          const edges = await tx.get(clan.collection('relationships'));
          if (
            edges.docs.some((d) => {
              const r = d.data();
              return (
                r.kind === newRelation!.kind &&
                r.from === newRelation!.from &&
                r.to === newRelation!.to
              );
            })
          )
            throw new ApiError(409, 'Quan hệ đã tồn tại. Hãy tải lại danh sách.');
          if (
            newRelation.kind === 'parent' &&
            createsAncestryCycle(
              edges.docs.map((d) => d.data() as FamilyRelationship),
              newRelation.from,
              newRelation.to,
            )
          )
            throw new ApiError(409, 'Quan hệ này tạo vòng lặp tổ tiên.');
        }
        const affectedEvents =
          existing.exists &&
          (!sameDate(existing.data()!.death, person.death) || person.lifeStatus !== 'deceased')
            ? await tx.get(clan.collection('events').where('personId', '==', id))
            : null;
        const version = existing.exists ? existing.data()!.version + 1 : 1;
        for (const doc of affectedEvents?.docs || [])
          if (!['completed', 'cancelled'].includes(doc.data().status))
            tx.update(doc.ref, {
              status: 'draft',
              dateConfirmed: false,
              version: doc.data().version + 1,
              reminderRevision: doc.data().reminderRevision + 1,
              reminderRevisionAt: FieldValue.serverTimestamp(),
            });
        if (newRelation) {
          const relationId = newRelation.kind + '_' + newRelation.from + '_' + newRelation.to;
          tx.set(clan.collection('relationships').doc(relationId), {
            ...newRelation,
            version: 1,
            archived: false,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: uid,
          });
        }
        tx.set(ref, {
          ...person,
          version,
          archived: false,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
        return finish({ id, version });
      }
      if (action === 'archivePerson' || action === 'restorePerson') {
        requireEditor();
        const ref = clan.collection('people').doc(validId(body.personId));
        const person = await tx.get(ref);
        if (!person.exists) throw new ApiError(404, 'Không tìm thấy hồ sơ.');
        expectVersion(person.data()!, body.version);
        const archive = action === 'archivePerson';
        if (archive) {
          const edges = await tx.get(
            clan.collection('relationships').where('archived', '==', false),
          );
          if (edges.docs.some((d) => d.data().from === ref.id || d.data().to === ref.id))
            throw new ApiError(
              409,
              'Hồ sơ còn quan hệ gia đình. Hãy gỡ các quan hệ liên quan trước khi đưa vào lưu trữ.',
            );
        }
        const affectedEvents = archive
          ? await tx.get(clan.collection('events').where('personId', '==', ref.id))
          : null;
        for (const doc of affectedEvents?.docs || [])
          if (!['completed', 'cancelled'].includes(doc.data().status))
            tx.update(doc.ref, {
              status: 'draft',
              dateConfirmed: false,
              delegateUid: '',
              delegateEpoch: '',
              delegateAssignmentVersion: 0,
              version: doc.data().version + 1,
              reminderRevision: doc.data().reminderRevision + 1,
              reminderRevisionAt: FieldValue.serverTimestamp(),
            });
        tx.update(ref, {
          archived: archive,
          version: person.data()!.version + 1,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
        return finish({ id: ref.id });
      }
      if (action === 'saveRelation') {
        requireEditor();
        let relation;
        try {
          relation = validateRelationship(body.relationship);
        } catch (e) {
          throw new ApiError(400, (e as Error).message);
        }
        validId(relation.from);
        validId(relation.to);
        if (relation.kind === 'spouse' && relation.from > relation.to)
          [relation.from, relation.to] = [relation.to, relation.from];
        const id = relation.kind + '_' + relation.from + '_' + relation.to;
        const ref = clan.collection('relationships').doc(id);
        const [from, to, old, edges] = await Promise.all([
          tx.get(clan.collection('people').doc(relation.from)),
          tx.get(clan.collection('people').doc(relation.to)),
          tx.get(ref),
          tx.get(clan.collection('relationships')),
        ]);
        for (const p of [from, to])
          if (!p.exists || p.data()!.archived)
            throw new ApiError(400, 'Hai người phải là hồ sơ đang hoạt động trong cùng dòng họ.');
        if (old.exists) expectVersion(old.data()!, body.version);
        else if (body.version !== null)
          throw new ApiError(409, 'Quan hệ đã thay đổi. Hãy tải lại.');
        const current = edges.docs
          .filter((d) => d.id !== id)
          .map((d) => d.data() as FamilyRelationship);
        if (relation.kind === 'parent' && createsAncestryCycle(current, relation.from, relation.to))
          throw new ApiError(409, 'Quan hệ này tạo vòng lặp tổ tiên. Vui lòng kiểm tra lại.');
        const version = old.exists ? old.data()!.version + 1 : 1;
        tx.set(ref, {
          ...relation,
          version,
          archived: false,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
        return finish({ id, version });
      }
      if (action === 'archiveRelation' || action === 'restoreRelation') {
        requireEditor();
        const ref = clan.collection('relationships').doc(validId(body.relationId));
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw new ApiError(404, 'Không tìm thấy quan hệ.');
        const relation = snapshot.data() as FamilyRelationship;
        expectVersion(relation, body.version);
        if (action === 'restoreRelation') {
          const [from, to, edges] = await Promise.all([
            tx.get(clan.collection('people').doc(relation.from)),
            tx.get(clan.collection('people').doc(relation.to)),
            tx.get(clan.collection('relationships')),
          ]);
          if (!from.exists || !to.exists || from.data()!.archived || to.data()!.archived)
            throw new ApiError(409, 'Khôi phục hồ sơ hai người trước khi khôi phục quan hệ.');
          if (
            relation.kind === 'parent' &&
            createsAncestryCycle(
              edges.docs.filter((d) => d.id !== ref.id).map((d) => d.data() as FamilyRelationship),
              relation.from,
              relation.to,
            )
          )
            throw new ApiError(409, 'Khôi phục quan hệ sẽ tạo vòng lặp tổ tiên.');
        }
        tx.update(ref, {
          archived: action === 'archiveRelation',
          version: relation.version + 1,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
        return finish({ id: ref.id });
      }
      if (action === 'request') {
        const personId = validId(body.personId);
        const person = await tx.get(clan.collection('people').doc(personId));
        if (!person.exists || person.data()!.archived)
          throw new ApiError(404, 'Hồ sơ không còn hoạt động.');
        if (body.kind !== 'claim' && body.kind !== 'correction')
          throw new ApiError(400, 'Loại đề nghị không hợp lệ.');
        if (body.kind === 'claim' && person.data()!.lifeStatus === 'deceased')
          throw new ApiError(400, 'Không thể nhận hồ sơ của người đã khuất.');
        if (
          typeof body.message !== 'string' ||
          body.message.trim().length < 5 ||
          body.message.length > 1000
        )
          throw new ApiError(400, 'Nội dung đề nghị cần từ 5 đến 1.000 ký tự.');
        const ref = clan.collection('personRequests').doc(body.kind + '_' + personId + '_' + uid);
        const old = await tx.get(ref);
        if (old.exists && old.data()!.status === 'pending')
          throw new ApiError(409, 'Bạn đã có đề nghị đang chờ xử lý cho hồ sơ này.');
        tx.set(ref, {
          personId,
          personName: person.data()!.name,
          uid,
          displayName: membership.data()!.displayName,
          kind: body.kind,
          message: body.message.trim(),
          status: 'pending',
          resolution: '',
          version: old.exists ? old.data()!.version + 1 : 1,
          createdAt: FieldValue.serverTimestamp(),
        });
        return finish({ id: ref.id });
      }
      if (action === 'resolveRequest') {
        requireAdmin();
        const ref = clan.collection('personRequests').doc(validId(body.requestId));
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw new ApiError(404, 'Không tìm thấy đề nghị.');
        const request = snapshot.data()!;
        expectVersion(request, body.version);
        if (request.status !== 'pending') throw new ApiError(409, 'Đề nghị đã được xử lý.');
        if (body.decision !== 'approve' && body.decision !== 'reject')
          throw new ApiError(400, 'Lựa chọn duyệt không hợp lệ.');
        if (
          typeof body.resolution !== 'string' ||
          body.resolution.trim().length < 3 ||
          body.resolution.length > 500
        )
          throw new ApiError(400, 'Ghi kết quả xử lý từ 3 đến 500 ký tự.');
        if (body.decision === 'approve' && request.kind === 'claim') {
          const [person, member, link] = await Promise.all([
            tx.get(clan.collection('people').doc(request.personId)),
            tx.get(store.doc('memberships/' + clanId + '_' + request.uid)),
            tx.get(clan.collection('personLinks').doc(request.personId)),
          ]);
          if (
            !member.exists ||
            !person.exists ||
            person.data()!.archived ||
            person.data()!.lifeStatus === 'deceased'
          )
            throw new ApiError(409, 'Người gửi hoặc hồ sơ không còn đủ điều kiện liên kết.');
          if (link.exists && link.data()!.uid !== request.uid)
            throw new ApiError(409, 'Hồ sơ đã được liên kết với tài khoản khác.');
          tx.set(clan.collection('personLinks').doc(request.personId), {
            uid: request.uid,
            personId: request.personId,
            approvedBy: uid,
            approvedAt: FieldValue.serverTimestamp(),
          });
        }
        tx.update(ref, {
          status:
            body.decision === 'reject'
              ? 'rejected'
              : request.kind === 'claim'
                ? 'approved'
                : 'resolved',
          resolution: body.resolution.trim(),
          version: request.version + 1,
          resolvedBy: uid,
          resolvedAt: FieldValue.serverTimestamp(),
        });
        return finish({ id: ref.id });
      }
      if (action === 'unlinkPerson') {
        requireAdmin();
        const ref = clan.collection('personLinks').doc(validId(body.personId));
        await tx.get(ref);
        tx.delete(ref);
        return finish({ id: ref.id });
      }
      throw new ApiError(400, 'Thao tác không được hỗ trợ.');
    },
    { maxAttempts: 5 },
  );
}

import { createHmac, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizePhone } from '../src/shared/domain/phone.ts';
import { adminAuth, ApiError, store } from './service.ts';
import { runtime } from './config.ts';

// Emulator-only key persisted with emulator data, never exposed to client/export.
// A cloud adapter must replace this with a managed server secret.
let keyPromise: Promise<string> | undefined;
async function key() {
  if (!runtime.local) return runtime.phoneKey;
  keyPromise ??= store
    .runTransaction(async (tx) => {
      const ref = store.doc('serverSecrets/phoneLookup');
      const snapshot = await tx.get(ref);
      if (snapshot.exists) return snapshot.data()!.key as string;
      const secret = randomBytes(32).toString('hex');
      tx.create(ref, { key: secret });
      return secret;
    })
    .catch((error) => {
      keyPromise = undefined;
      throw error;
    });
  return keyPromise;
}
export async function phoneKey(phone: string) {
  return createHmac('sha256', await key())
    .update(phone)
    .digest('hex');
}
export async function requireAccount(uid: string) {
  const account = (await store.doc('accounts/' + uid).get()).data();
  if (!account?.complete)
    throw new ApiError(403, 'Hoàn tất tên và số điện thoại trước khi tiếp tục.');
  return account;
}
export async function accountAction(uid: string, body: Record<string, unknown>, authTime: number) {
  if (body.action === 'get') {
    const data = (await store.doc('accounts/' + uid).get()).data();
    return {
      account: data?.complete
        ? { displayName: data.displayName, phone: data.phone, version: data.version }
        : null,
    };
  }
  if (body.action !== 'save') throw new ApiError(400, 'Thao tác tài khoản không hợp lệ.');
  let phone: string;
  try {
    phone = normalizePhone(body.phone);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
  if (
    typeof body.displayName !== 'string' ||
    body.displayName.trim().length < 2 ||
    body.displayName.trim().length > 80
  )
    throw new ApiError(400, 'Tên cần từ 2 đến 80 ký tự.');
  const name = body.displayName.trim();
  const hash = await phoneKey(phone);
  const identity = await adminAuth.getUser(uid);
  // Password identities remain available only in this hard-wired local environment for fixtures.
  if (
    identity.disabled ||
    !identity.providerData.some(
      (p) =>
        p.providerId === 'google.com' ||
        (runtime.local && p.providerId === 'password' && identity.email?.endsWith('.test')),
    )
  )
    throw new ApiError(403, 'Cần đăng nhập Google để hoàn tất tài khoản.');
  return store.runTransaction(async (tx) => {
    const ref = store.doc('accounts/' + uid);
    const snapshot = await tx.get(ref);
    const previous = snapshot.data();
    if ((previous?.version ?? null) !== body.version)
      throw new ApiError(409, 'Tài khoản đã thay đổi. Hãy tải lại.');
    const changing = previous && previous.phoneKey !== hash;
    if (changing && (Date.now() / 1000 - authTime > 300 || !authTime))
      throw new ApiError(401, 'Đăng nhập Google lại trước khi đổi số điện thoại.');
    const claimRef = store.doc('phoneClaims/' + hash);
    const claim = (await tx.get(claimRef)).data();
    const oldRef = changing ? store.doc('phoneClaims/' + previous.phoneKey) : null;
    const old = oldRef ? (await tx.get(oldRef)).data() : null;
    if (claim?.uid && claim.uid !== uid)
      throw new ApiError(409, 'Không thể sử dụng số này. Kiểm tra lại hoặc liên hệ hỗ trợ.');
    const generation = claim?.uid === uid ? claim.generation : (claim?.generation ?? 0) + 1;
    if (oldRef && old?.uid === uid) tx.set(oldRef, { uid: null, generation: old.generation + 1 });
    tx.set(claimRef, { uid, generation });
    const account = {
      displayName: name,
      phone,
      phoneKey: hash,
      phoneGeneration: generation,
      complete: true,
      version: (previous?.version ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, account);
    return { account: { displayName: name, phone, version: account.version } };
  });
}

// Bounded local limiter: no phone, token or request bodies retained. Cloud requires a shared limiter.
const buckets = new Map<string, { start: number; count: number }>();
export function limitAccountRequest(uid: string, action: string) {
  const now = Date.now();
  for (const [id, bucket] of buckets) if (now - bucket.start >= 60000) buckets.delete(id);
  const id = uid + ':' + action;
  const bucket = buckets.get(id) ?? { start: now, count: 0 };
  if (++bucket.count > (action === 'read' ? 120 : 30) || buckets.size > 10000)
    throw new ApiError(429, 'Bạn thao tác quá nhanh. Hãy thử lại sau một phút.');
  buckets.set(id, bucket);
}

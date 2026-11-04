import { createHmac } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = 'demo-coinguon';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

async function resetEndpoint(label, url) {
  const response = await fetch(url, {
    method: 'DELETE',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Không thể làm sạch ${label} emulator (HTTP ${response.status}).`);
  }
}

await resetEndpoint(
  'Firestore',
  `http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`,
);
await resetEndpoint('Auth', `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`);

const app = initializeApp({ projectId }, 'coinguon-seed');
const adminAuth = getAuth(app);
const store = getFirestore(app);

try {
  const hmacSecret = '0123456789abcdef'.repeat(4);
  const hashPhone = (phone) => createHmac('sha256', hmacSecret).update(phone).digest('hex');

  const clanId = 'seed-clan-tran';
  const accounts = [
    {
      uid: 'seed-admin',
      email: 'seed-admin@gia-dinh.test',
      displayName: 'Trần Minh Đức',
      phone: '+84901000101',
      role: 'admin',
    },
    {
      uid: 'seed-editor',
      email: 'seed-editor@gia-dinh.test',
      displayName: 'Trần Minh Khôi',
      phone: '+84901000102',
      role: 'editor',
    },
    {
      uid: 'seed-member',
      email: 'seed-member@gia-dinh.test',
      displayName: 'Trần Ngọc Mai',
      phone: '+84901000103',
      role: 'member',
    },
  ];

  for (const user of accounts) {
    await adminAuth.createUser({
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      password: 'local-test-12345',
      displayName: user.displayName,
    });
  }

  const batch = store.batch();
  batch.set(store.doc('serverSecrets/phoneLookup'), { key: hmacSecret });
  batch.set(store.doc(`clans/${clanId}`), {
    name: 'Họ Trần An Hòa (Mẫu)',
    ownerUid: 'seed-admin',
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(store.doc(`clans/${clanId}/genealogyMeta/lock`), {
    version: 1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(store.doc(`clans/${clanId}/membershipMeta/lock`), {
    version: 1,
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const user of accounts) {
    const phoneKey = hashPhone(user.phone);
    batch.set(store.doc(`phoneClaims/${phoneKey}`), {
      uid: user.uid,
      generation: 1,
    });
    batch.set(store.doc(`accounts/${user.uid}`), {
      displayName: user.displayName,
      phone: user.phone,
      phoneKey,
      phoneGeneration: 1,
      complete: true,
      version: 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(store.doc(`memberships/${clanId}_${user.uid}`), {
      clanId,
      uid: user.uid,
      displayName: user.displayName,
      role: user.role,
      invitationId: null,
      managementVersion: 1,
      joinedAt: FieldValue.serverTimestamp(),
    });
  }

  const emptyDate = (calendar = 'solar') => ({
    calendar,
    day: null,
    month: null,
    year: null,
    leapMonth: false,
  });

  const people = [
    {
      id: 'tran-van-an',
      name: 'Trần Văn An',
      aliases: 'Cụ An',
      lifeStatus: 'deceased',
      birth: { calendar: 'solar', day: 10, month: 3, year: 1935, leapMonth: false },
      death: { calendar: 'lunar', day: 15, month: 8, year: 1998, leapMonth: false },
      branch: 'Chi trưởng',
      biography: 'Hồ sơ nhân vật giả lập phục vụ kiểm thử tự động.',
      source: 'Sổ gia phả mẫu thử nghiệm',
      verified: true,
      version: 1,
      archived: false,
    },
    {
      id: 'tran-minh-duc',
      name: 'Trần Minh Đức',
      aliases: '',
      lifeStatus: 'living',
      birth: { calendar: 'solar', day: 12, month: 4, year: 1968, leapMonth: false },
      death: emptyDate('solar'),
      branch: 'Chi trưởng',
      biography: 'Con trưởng trong dữ liệu mẫu giả lập.',
      source: 'Sổ gia phả mẫu thử nghiệm',
      verified: true,
      version: 1,
      archived: false,
    },
    {
      id: 'tran-ngoc-mai',
      name: 'Trần Ngọc Mai',
      aliases: '',
      lifeStatus: 'living',
      birth: { calendar: 'solar', day: 20, month: 9, year: 1995, leapMonth: false },
      death: emptyDate('solar'),
      branch: 'Chi trưởng',
      biography: 'Thế hệ thứ ba trong dữ liệu mẫu giả lập.',
      source: 'Sổ gia phả mẫu thử nghiệm',
      verified: true,
      version: 1,
      archived: false,
    },
  ];

  for (const person of people) {
    const { id, ...fields } = person;
    batch.set(store.doc(`clans/${clanId}/people/${id}`), fields);
  }

  const relationships = [
    {
      id: 'rel-an-duc',
      from: 'tran-van-an',
      to: 'tran-minh-duc',
      kind: 'parent',
      parentType: 'biological',
      status: 'current',
      source: 'Sổ gia phả mẫu thử nghiệm',
      verified: true,
      version: 1,
      archived: false,
    },
    {
      id: 'rel-duc-mai',
      from: 'tran-minh-duc',
      to: 'tran-ngoc-mai',
      kind: 'parent',
      parentType: 'biological',
      status: 'current',
      source: 'Sổ gia phả mẫu thử nghiệm',
      verified: true,
      version: 1,
      archived: false,
    },
  ];

  for (const rel of relationships) {
    const { id, ...fields } = rel;
    batch.set(store.doc(`clans/${clanId}/relationships/${id}`), fields);
  }

  batch.set(store.doc(`clans/${clanId}/anniversaryRules/tran-van-an`), {
    calendar: 'lunar',
    leapPolicy: 'regular',
    missingDayPolicy: 'last-day',
    sourceDate: { calendar: 'lunar', day: 15, month: 8, year: 1998, leapMonth: false },
    version: 1,
  });

  await batch.commit();
  console.log(
    `[Seed] Đã làm sạch & nạp dữ liệu mẫu cho ${projectId} (clan: ${clanId}, 3 tài khoản, 3 hồ sơ, 2 quan hệ, 1 quy tắc giỗ).`,
  );
} finally {
  await deleteApp(app);
}

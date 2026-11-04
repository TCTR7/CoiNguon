/** Pilot accepts Vietnamese mobile numbers; this does not verify ownership. */
export function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Nhập số di động Việt Nam hợp lệ.');
  const compact = value.trim().replace(/[\s().-]/g, '');
  const local = compact.startsWith('+84') ? '0' + compact.slice(3) : compact;
  if (!/^0[35789]\d{8}$/.test(local))
    throw new Error('Nhập số di động Việt Nam gồm 10 chữ số, đầu 0 hoặc +84.');
  return '+84' + local.slice(1);
}

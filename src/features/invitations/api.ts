export class InvitationApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function invitationRequest<T>(
  path: string,
  payload: Record<string, unknown>,
  token?: string,
): Promise<T> {
  if (!navigator.onLine)
    throw new Error(
      'Đang ngoại tuyến. Kết nối mạng trước khi gửi; ứng dụng không xếp hàng phản hồi.',
    );
  const controller = new AbortController(),
    timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch('http://127.0.0.1:8787/api/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const data = await res.json();
    if (!res.ok)
      throw new InvitationApiError(data.error || 'Chưa thực hiện được. Hãy thử lại.', res.status);
    return data;
  } catch (e) {
    if (e instanceof TypeError || (e as Error).name === 'AbortError')
      throw new Error(
        'Chưa kết nối được dịch vụ local. Tải cập nhật trước khi gửi lại để biết phản hồi đã được lưu hay chưa.',
      );
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

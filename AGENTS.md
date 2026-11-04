> **LUẬT BẮT BUỘC DÒNG ĐẦU TIÊN (`codegraph` MCP):** Luôn gọi MCP tool `codegraph` (`codegraph_explore`) ở bước đầu tiên để khảo sát kiến trúc, symbol, callers/callees và vùng ảnh hưởng; TUYỆT ĐỐI KHÔNG dùng `read_file` đọc tràn lan mã nguồn hoặc dùng `grep` quét mù toàn repo.

# SYSTEM RULES & HARNESS CONFIGURATION — Cội Nguồn

## 1. Context & CodeGraph MCP Routing (BẮT BUỘC)
- TUYỆT ĐỐI KHÔNG dùng `read_file` đọc toàn bộ file lớn hoặc dùng `grep` quét toàn repo ở bước đầu tiên.
- BƯỚC 1: Luôn gọi MCP tool của `codegraph` (`codegraph_explore` — tìm callers, callees, dependency tree, symbol references) để xác định chính xác file và dòng lệnh bị ảnh hưởng.
- BƯỚC 2: Chỉ dùng `read_file` đọc các file cấu hình gốc hoặc đúng khoảng dòng (`StartLine`–`EndLine`) nằm trong kết quả của CodeGraph khi cần xem phần bị lược bớt.
- Giao tiếp với chủ dự án bằng tiếng Việt; dùng định danh tiếng Anh trong code; giữ nguyên mã hóa UTF-8 tiếng Việt.

## 2. Kiến trúc & Dữ liệu (Hard Constraints)
- Không tự ý thêm/bớt/sửa trường dữ liệu ngoài file Schema/Contract đã chốt trong `docs/plans/` và giữ đúng phạm vi MVP (không tự thêm thanh toán, marketplace, white-label).
- Tách biệt `Account`, hồ sơ `Person` và `Membership`; cô lập dữ liệu từng `clan`; bắt buộc cưỡng chế phân quyền ở Backend và Firestore/Storage Rules (cấm chỉ kiểm tra ở UI).
- Giữ nguyên ngày gốc và loại lịch (`lunar` / `solar`); tách biệt ngày mất, quy tắc giỗ (`anniversaryRules`) và ngày sự kiện thực tế (`events`); cấm tự bịa dữ liệu phả hệ hoặc tự giải quyết ngầm ngày âm lịch ngoại lệ.
- Với lưu trữ Offline trên PWA: Chỉ cho phép chế độ đọc (read-only) qua IndexedDB (`coinguon-private-v1`); cấm dùng `localStorage` cho mảng dữ liệu/object lớn và cấm âm thầm xếp hàng ghi offline.
- Mọi hàm thay đổi dữ liệu (Mutation, RSVP, ủy quyền, nhắc lịch) phải xử lý trạng thái Loading, Error rollback và chống bấm đúp / xung đột đồng thời (Debounce, Idempotency, kiểm tra `version`).

## 3. Quy tắc bàn giao (Definition of Done)
- Cấm tự ý xóa, làm yếu hoặc sửa đổi các bài test hiện có chỉ để làm cho test pass; bảo toàn mọi thay đổi không liên quan đang có trong workspace.
- Bắt buộc gắn chính xác 100% các mã `data-testid` đã được định nghĩa trong file Plan của task (`docs/plans/`).
- Chỉ dùng dữ liệu nhân vật giả lập (synthetic) cho seed, test và demo; cấm commit dữ liệu gia đình thật, token, thông tin xác thực hoặc khóa dịch vụ; không tự ý deploy hay bật billing.
- Kiểm định tích hợp qua khẩu lệnh chuẩn `npm run verify:all` (Seed Data + Typecheck + Playwright E2E) và báo cáo trung thực kết quả thực chạy.

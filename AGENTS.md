> **LUẬT BẮT BUỘC DÒNG ĐẦU TIÊN (`codegraph` MCP — QUY TRÌNH PHỄU):** Luôn bắt đầu bằng `codegraph_query` để lấy danh sách tên symbol và tọa độ dòng trước; sau đó mới dùng `codegraph_callers`/`callees`/`impact` và `codegraph_node` (chỉ truyền tên hàm cụ thể). TUYỆT ĐỐI KHÔNG dùng `read_file` đọc tràn lan, KHÔNG dùng `grep` quét mù toàn repo, và CẤM gọi `codegraph_explore` ở bước đầu tiên.

# SYSTEM RULES & HARNESS CONFIGURATION — Cội Nguồn

## 1. Context & CodeGraph MCP Routing (BẮT BUỘC)
- TUYỆT ĐỐI KHÔNG dùng `read_file` đọc toàn bộ file lớn (như `treeLayout.ts`, `genealogy.ts`, `anniversary.ts`, `FamilyTree.tsx`) hoặc dùng `grep` quét toàn repo ở bước đầu tiên.
- BƯỚC 1: Dùng `codegraph_query` hoặc `codegraph_node` (chỉ truyền **tên hàm/symbol cụ thể**, KHÔNG truyền đường dẫn cả file dài) kết hợp `codegraph_callers` / `codegraph_callees` / `codegraph_impact` để xác định chính xác hàm và dòng lệnh bị ảnh hưởng. "Khi chưa biết tên symbol, bắt buộc dò bằng codegraph_query trước; chỉ được gọi codegraph_explore (tối đa 1 lần/task) khi codegraph_query không trả về kết quả.
- BƯỚC 2: Chỉ dùng `read_file` đọc đúng khoảng dòng (`StartLine`–`EndLine`, tối đa 120 dòng/lần) quanh hàm cần sửa.
- Giao tiếp với chủ dự án bằng tiếng Việt ngắn gọn, trực diện (không giải thích dài dòng lại code vừa viết); dùng định danh tiếng Anh trong code; giữ nguyên mã hóa UTF-8 tiếng Việt.

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
- Trong quá trình sửa lỗi (Iterative Debugging): TUYỆT ĐỐI KHÔNG chạy `npm run verify:all` hay chạy toàn bộ 42 bài test. Bắt buộc dùng `codegraph affected <file-vừa-sửa>` để tìm file test liên quan, sau đó chỉ chạy ĐÚNG 1 bài test đang lỗi bằng lệnh: `npm run test:ai:e2e -- -g "<tên bài test>" --project=chromium` (hoặc `npm run test:ai:unit -- <tên-file-test>` cho unit test). Chỉ khi PASS trên Desktop mới chạy bài đó trên Mobile.
- Chỉ khi toàn bộ các bài test đơn lẻ liên quan đã PASS hoàn toàn mới được phép chạy `npm run typecheck` và chạy nghiệm thu cuối cùng (khi chủ dự án yêu cầu).

## 4. Chốt chặn chống tràn Token (Strict Token Guardrails)
- **Cấm tự ý chụp và đọc ảnh (Anti-Vision Bloat):** TUYỆT ĐỐI KHÔNG viết script inline (`node --input-type=module`) để chụp screenshot `fullPage: true` và TUYỆT ĐỐI KHÔNG dùng công cụ đọc/xem file ảnh (`.png`, `.jpg`, `.webp`) để debug giao diện trừ khi chủ dự án yêu cầu rõ ràng. Mọi kiểm tra vị trí, zoom canvas, hiển thị thẻ trên Desktop/Mobile phải thực hiện qua Playwright Assertions (`toBeVisible()`, `boundingBox()`, `toHaveCSS()`, `evaluate()`).
- **Cấm đọc `error-context.md` & Git diff tràn lan:** TUYỆT ĐỐI KHÔNG dùng `Get-ChildItem`, `Get-Content`, `cat` để quét hoặc đọc các file `error-context.md` và `trace.zip` trong `automation_test/artifacts/` hoặc `test-results/`. Chỉ đọc dòng báo lỗi trực tiếp từ stdout terminal. Khi kiểm tra trạng thái Git, chỉ dùng `git status --short` và `git diff --stat` (chỉ chạy `git diff <file>` trên đúng file cần xem).
- **Circuit Breaker (Cầu chì ngắt vòng lặp):** Nếu 1 bài test FAIL liên tiếp sau **2 lần sửa code**, DỪNG NGAY LẬP TỨC việc chạy lệnh và sửa tiếp. Báo cáo nguyên nhân gốc rễ ngắn gọn (dưới 10 dòng) và chờ chủ dự án chỉ đạo.

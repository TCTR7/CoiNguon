# AI_ORCHESTRATION_PLAYBOOK.md
> **Sổ tay Quy chuẩn Điều phối Multi-Agent & Kiểm định Hệ thống Thực chiến (Master Blueprint)**
> **Mục tiêu:** Vận hành mô hình "One-Person Squad" — Tối ưu hóa Token qua MCP, Khóa kiến trúc bằng Data Contract, Kiểm chứng chéo độc lập (Dual-Session TDD) và Tự động hóa E2E đa người dùng.

---

## PHẦN 1: QUY TRÌNH KHỞI TẠO & CHUYỂN ĐỔI DỰ ÁN (AGENT BOOTSTRAP PROTOCOL)

Khi người dùng yêu cầu: *"Hãy áp dụng AI_ORCHESTRATION_PLAYBOOK.md cho dự án này"*, AI Agent BẮT BUỘC thực hiện tuần tự 5 bước dưới đây (KHÔNG chạy test, KHÔNG chạy build, KHÔNG đọc mã nguồn nghiệp vụ trong lúc thiết lập):

- [ ] **Bước 1 — Khảo sát cấu hình gốc (Lightweight Audit):**
  - Chỉ đọc `package.json` (hoặc `pyproject.toml`/`requirements.txt`), `.gitignore`, file cấu hình test (`playwright.config.*`, `vitest.config.*`) và file `AGENTS.md` / `CLAUDE.md` (nếu đã tồn tại).
  - Xác định Tech Stack thực tế của dự án (ví dụ: React + Firebase, Next.js + FastAPI, PWA...).

- [ ] **Bước 2 — Cập nhật `.gitignore` (Chặn index rác):**
  - Bổ sung vào `.gitignore` (nếu chưa có): `.codegraph/`, `test-results/`, `playwright-report/`, `automation_test/artifacts/` (hoặc thư mục chứa ảnh/log test tương ứng của dự án).

- [ ] **Bước 3 — Chuẩn hóa lệnh điều khiển (`package.json`) & Khóa Playwright:**
  - Giữ nguyên toàn bộ script hiện có của dự án và bổ sung bộ script chuẩn hóa:
    + `"test:ai:unit"`: Chạy unit test (Vitest/Jest/Pytest) với cờ rút gọn log và dừng ngay ở lỗi đầu tiên (`--reporter=dot --bail=1` hoặc `-x -q`).
    + `"test:ai:e2e"`: Chạy Playwright với cờ `--reporter=line --max-failures=1 --trace=off --screenshot=off`.
    + Chuẩn hóa các lệnh tích hợp (nếu dự án có dùng): `db:reset-and-seed`, `test:e2e:multi`, `verify:all`.
  - Mở tất cả các file `playwright*.config.ts` trong dự án, thêm biến `const isAiAgent = process.env.AI_AGENT === '1';` để khi chạy qua AI Agent thì tự động ép `maxFailures: 1`, `reporter: [['line']]`, và đặt `screenshot: 'off'`, `video: 'off'`, `trace: 'off'` (ngăn sinh file `error-context.md`).

- [ ] **Bước 4 — Khởi tạo hoặc Hợp nhất file `/AGENTS.md`:**
  - Nếu dự án **chưa có** `AGENTS.md`: Tạo mới theo đúng Mẫu chuẩn ở Phần 2.2, tự động điền quy tắc Tech Stack tương ứng vào Mục 2.
  - Nếu dự án **đang làm dở và đã có** `AGENTS.md`: **GIỮ NGUYÊN 100%** các quy tắc nghiệp vụ/kiến trúc riêng trong Mục 2 của dự án đó; chỉ cập nhật/ghi đè Dòng đầu tiên, Mục 1 (CodeGraph Phễu 4 Bước), Mục 3 (Test đơn lẻ) và Mục 4 (Chốt chặn chống tràn Token).

- [ ] **Bước 5 — Tạo thư mục lưu trữ Plan & Kiểm tra Index:**
  - Tạo thư mục `docs/plans/` (nếu chưa có) để lưu trữ đặc tả kỹ thuật và hợp đồng dữ liệu (`task-xx.md`).
  - Kiểm tra trạng thái CodeGraph bằng lệnh `codegraph status` (nếu dự án chưa khởi tạo CodeGraph thì chạy `codegraph init`).

---

## PHẦN 2: KỸ NĂNG 1 — QUẢN TRỊ NGỮ CẢNH & ĐIỀU HƯỚNG CÔNG CỤ (CONTEXT & MCP ROUTING)

### 1. Nguyên tắc cốt lõi
- Không để Agent dùng `read_file` đọc tràn lan toàn bộ file hoặc dùng `grep` quét mù quáng gây tốn token và làm "loãng" bộ nhớ ngữ cảnh (Context Pollution).
- Không viết những mô tả thư mục hiển nhiên vào `AGENTS.md`. Chỉ ghi **Quy tắc điều hướng công cụ (Routing Rules)**, **Ràng buộc kiến trúc (Hard Constraints)** và **Chốt chặn Token (Token Guardrails)**.
- Áp dụng **Quy trình Phễu 4 Bước** với CodeGraph: Luôn đi từ lệnh chỉ mục siêu nhẹ (`codegraph_query` $\rightarrow$ `callers`/`callees`/`impact`) trước khi đọc mã nguồn của đúng 1 hàm bằng `codegraph_node`. Cấm gọi `codegraph_explore` ngay bước đầu tiên.
- Kiểm soát token chặt chẽ: Cấm tự ý chụp/đọc ảnh giao diện, cấm đọc file `error-context.md`, cấm chạy test toàn cục (`verify:all`) trong lúc debug.

### 2. Mẫu chuẩn file `/AGENTS.md` (Dùng để sinh tự động cho mọi Project)

```markdown
> **LUẬT BẮT BUỘC DÒNG ĐẦU TIÊN (`codegraph` MCP — QUY TRÌNH PHỄU):** Luôn bắt đầu bằng `codegraph_query` để lấy danh sách tên symbol và tọa độ dòng trước; sau đó mới dùng `codegraph_callers`/`callees`/`impact` và `codegraph_node` (chỉ truyền tên hàm cụ thể). TUYỆT ĐỐI KHÔNG dùng `read_file` đọc tràn lan, KHÔNG dùng `grep` quét mù toàn repo, và CẤM gọi `codegraph_explore` ở bước đầu tiên.

# SYSTEM RULES & HARNESS CONFIGURATION

## 1. Context & CodeGraph MCP Routing (BẮT BUỘC TUÂN THỦ THEO THỨ TỰ)
- TUYỆT ĐỐI KHÔNG dùng `read_file` đọc toàn bộ file lớn hoặc dùng `grep` quét toàn repo.
- **BƯỚC 1 — Tìm tên Symbol (Siêu nhẹ):** Luôn gọi `codegraph_query` với từ khóa ngắn gọn để lấy tên hàm/biến/component và vị trí dòng. Khi chưa biết tên symbol, BẮT BUỘC dùng `codegraph_query` để dò tìm, KHÔNG được lấy lý do chưa biết symbol để gọi `codegraph_explore`.
- **BƯỚC 2 — Kiểm tra liên đới:** Gọi `codegraph_callers`, `codegraph_callees` hoặc `codegraph_impact` trên tên symbol vừa tìm được để nắm luồng gọi hàm và phạm vi ảnh hưởng.
- **BƯỚC 3 — Đọc mã nguồn nội soi (`Surgical Read`):**
  - Gọi `codegraph_node` với **chính xác tên hàm/symbol cụ thể** (TUYỆT ĐỐI KHÔNG truyền đường dẫn cả file dài vào `codegraph_node`).
  - Nếu cần xem phần code/JSX xung quanh không nằm trọn trong 1 hàm, dùng `read_file` nhưng chỉ đọc đúng khoảng dòng (`StartLine`–`EndLine`, tối đa 80–120 dòng/lần).
  - Chỉ được phép gọi `codegraph_explore` (tối đa 1 lần/task) nếu đã thử `codegraph_query` với 2 từ khóa khác nhau mà không ra kết quả.
- **BƯỚC 4 — Khoanh vùng Test sau khi sửa:** Chạy `codegraph affected <file-vừa-sửa>` để xác định đúng file test cần chạy ở Mục 3.
- Giao tiếp với chủ dự án bằng tiếng Việt ngắn gọn, trực diện (không giải thích dài dòng lại code vừa viết); dùng định danh tiếng Anh trong code; giữ nguyên mã hóa UTF-8 tiếng Việt.

## 2. Kiến trúc & Dữ liệu (Hard Constraints)
<!-- AGENT CHÚ Ý: Giữ nguyên các quy tắc nghiệp vụ hiện có của dự án (nếu đang nâng cấp dự án cũ) hoặc tùy chỉnh theo Tech Stack thực tế của dự án mới dựa trên các nguyên tắc gốc sau: -->
- Không tự ý thêm/bớt/sửa trường dữ liệu ngoài file Schema/Contract đã chốt trong `docs/plans/` và giữ đúng phạm vi tính năng được giao.
- Bắt buộc cưỡng chế phân quyền và xác thực dữ liệu ở tầng Backend / Database Rules (cấm chỉ kiểm tra ở UI).
- Với lưu trữ Offline trên PWA (nếu có): Bắt buộc dùng IndexedDB (cấm dùng `localStorage` cho mảng dữ liệu hoặc object lớn).
- Mọi hàm thay đổi dữ liệu (Mutation / API Call) phải xử lý trạng thái Loading, Error rollback và chống bấm đúp / xung đột đồng thời (Debounce / Idempotency).

## 3. Quy tắc bàn giao (Definition of Done)
- Cấm tự ý xóa, làm yếu hoặc sửa đổi các bài test hiện có chỉ để làm cho test pass; bảo toàn mọi thay đổi không liên quan đang có trong workspace.
- Bắt buộc gắn chính xác 100% các mã `data-testid` đã được định nghĩa trong file Plan của task (`docs/plans/`).
- Chỉ dùng dữ liệu giả lập (synthetic) cho seed, test và demo; cấm commit dữ liệu thật, token, thông tin xác thực hoặc khóa dịch vụ; không tự ý deploy hay bật billing.
- Trong quá trình sửa lỗi (Iterative Debugging): TUYỆT ĐỐI KHÔNG chạy `npm run verify:all` hay chạy toàn bộ test suite. Bắt buộc dùng `codegraph affected <file-vừa-sửa>` để tìm file test liên quan, sau đó chỉ chạy ĐÚNG 1 bài test đang lỗi bằng lệnh: `npm run test:ai:e2e -- -g "<tên bài test>" --project=chromium` (hoặc `npm run test:ai:unit -- <tên-file-test>` cho unit test). Chỉ khi PASS trên Desktop mới chạy bài đó trên Mobile.
- Chỉ khi toàn bộ các bài test đơn lẻ liên quan đã PASS hoàn toàn mới được phép chạy `npm run typecheck` và chạy nghiệm thu cuối cùng (khi chủ dự án yêu cầu).

## 4. Chốt chặn chống tràn Token (Strict Token Guardrails)
- **Cấm tự ý chụp và đọc ảnh (Anti-Vision Bloat):** TUYỆT ĐỐI KHÔNG viết script inline (`node --input-type=module`) để chụp screenshot `fullPage: true` và TUYỆT ĐỐI KHÔNG dùng công cụ đọc/xem file ảnh (`.png`, `.jpg`, `.webp`) để debug giao diện trừ khi chủ dự án yêu cầu rõ ràng. Mọi kiểm tra vị trí, bố cục, hiển thị trên Desktop/Mobile phải thực hiện qua Playwright Assertions (`toBeVisible()`, `boundingBox()`, `toHaveCSS()`, `evaluate()`).
- **Cấm đọc `error-context.md`:** TUYỆT ĐỐI KHÔNG dùng `Get-ChildItem`, `Get-Content`, `cat` để quét hoặc đọc các file `error-context.md` và `trace.zip` trong thư mục kết quả test. Chỉ đọc dòng báo lỗi trực tiếp từ stdout terminal.
- **Circuit Breaker (Cầu chì ngắt vòng lặp):** Nếu 1 bài test FAIL liên tiếp sau **2 lần sửa code**, DỪNG NGAY LẬP TỨC việc chạy lệnh và sửa tiếp. Báo cáo nguyên nhân gốc rễ ngắn gọn (dưới 10 dòng) và chờ chủ dự án chỉ đạo.

# SYSTEM RULES & HARNESS CONFIGURATION

## 1. Context & CodeGraph MCP Routing (BẮT BUỘC)
- TUYỆT ĐỐI KHÔNG dùng `read_file` đọc toàn bộ file lớn hoặc dùng `grep` quét toàn repo ở bước đầu tiên.
- BƯỚC 1: Dùng `codegraph_query` hoặc `codegraph_node` (chỉ truyền **tên hàm/symbol cụ thể**, KHÔNG truyền đường dẫn cả file dài) kết hợp `codegraph_callers` / `codegraph_callees` / `codegraph_impact` để xác định chính xác hàm và dòng lệnh bị ảnh hưởng. Chỉ dùng `codegraph_explore` khi thực sự chưa biết tên symbol nào và phải giới hạn từ khóa cực kỳ cụ thể.
- BƯỚC 2: Chỉ dùng `read_file` đọc đúng khoảng dòng (`StartLine`–`EndLine`, tối đa 120 dòng/lần) quanh hàm cần sửa.

## 2. Kiến trúc & Dữ liệu (Hard Constraints)
- Không tự ý thêm/bớt/sửa trường dữ liệu ngoài file Schema/Contract đã chốt trong `docs/plans/`.
- Với lưu trữ Offline trên PWA: Bắt buộc dùng IndexedDB (cấm dùng `localStorage` cho mảng dữ liệu hoặc object lớn).
- Mọi hàm thay đổi dữ liệu (Mutation) phải xử lý trạng thái Loading, Error rollback và chống bấm đúp (Debounce / Idempotency).

## 3. Quy tắc bàn giao (Definition of Done)
- Cấm tự ý xóa, làm yếu hoặc sửa đổi các bài test hiện có chỉ để làm cho test pass.
- Bắt buộc gắn chính xác 100% các mã `data-testid` đã được định nghĩa trong file Plan của task.
- Trong quá trình sửa lỗi (Iterative Debugging): TUYỆT ĐỐI KHÔNG chạy `npm run verify:all` hay chạy toàn bộ test suite. Bắt buộc dùng `codegraph affected <file-vừa-sửa>` để tìm file test liên quan, sau đó chỉ chạy ĐÚNG 1 bài test đang lỗi bằng lệnh: `npm run test:ai:e2e -- -g "<tên bài test>" --project=chromium` (hoặc `npm run test:ai:unit -- <tên-file-test>` cho unit test).
- Chỉ khi toàn bộ các bài test đơn lẻ liên quan đã PASS mới được phép chạy kiểm tra toàn diện.

## 4. Chốt chặn chống tràn Token (Strict Token Guardrails)
- **Cấm tự ý chụp và đọc ảnh (Anti-Vision Bloat):** TUYỆT ĐỐI KHÔNG viết script chụp screenshot `fullPage: true` và TUYỆT ĐỐI KHÔNG đọc/xem file ảnh để debug giao diện trừ khi có yêu cầu rõ ràng. Xác thực qua Playwright Assertions (`toBeVisible()`, `boundingBox()`, `toHaveCSS()`).
- **Cấm đọc `error-context.md`:** TUYỆT ĐỐI KHÔNG quét hoặc đọc `error-context.md` và `trace.zip`. Chỉ đọc dòng báo lỗi trực tiếp từ stdout terminal.
- **Circuit Breaker (Cầu chì ngắt vòng lặp):** Nếu 1 bài test FAIL liên tiếp sau 2 lần sửa code, DỪNG NGAY LẬP TỨC việc chạy lệnh và sửa tiếp để báo cáo nguyên nhân và chờ chỉ đạo.
```

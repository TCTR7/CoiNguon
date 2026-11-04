# Chiến lược kiểm thử

Hiện có Vitest cho UI mẫu, logic ngày/đồ thị, rules và API gia phả/lịch giỗ/thiệp; Playwright + axe cho UI mẫu, workspace hai tài khoản và gia phả/lịch giỗ có lưu dữ liệu; xem lệnh tại DEVELOPMENT.md. Các ca nghiệp vụ bên dưới là kế hoạch theo từng bước, chưa đồng nghĩa toàn bộ AC đã được triển khai. Tiêu chí chức năng nằm tại AC-01 đến AC-11 trong [PRD](PRD_CoiNguon_App.md).

Cấu trúc và lệnh chạy từng tính năng: [automation_test/README.md](../automation_test/README.md). pages/ giữ thao tác dùng lại, tests/ giữ kịch bản và assertion; API/rules nằm cùng miền, unit test giữ trong src/.

## Theo loại thay đổi

`npm test` chạy unit frontend/domain rồi backend Node riêng trong `automation_test/vitest.backend.config.ts`. Backend kiểm tra cấu hình cloud lỗi, tách API/worker và từ chối request thiếu xác thực/origin sai mà không truy cập Firebase thật. API Emulator có ca counter tần suất đồng thời; Rules chặn client đọc/ghi requestBudgets. Runner local ép mode/project demo ngay cả khi `.env.local` chứa cấu hình Firebase thật. Chạy cloud OAuth/IAM/index trên staging vẫn là bước riêng.

- Chỉ tài liệu: kiểm tra link tương đối, UTF-8, tính nhất quán giữa phạm vi/quyết định/trạng thái. Không cần tạo test ứng dụng cho sửa câu chữ.
- Logic miền: unit test trường hợp bình thường, biên và dữ liệu thiếu.
- Quyền/truy cập dữ liệu: integration test với emulator hoặc môi trường cô lập, bao gồm truy cập bị từ chối.
- Luồng UI: kiểm tra đường đi chính và trạng thái lỗi; kiểm thử trực tiếp trên trình duyệt/thiết bị mục tiêu khi cần.
- Trước pilot: thực hiện toàn bộ AC, thử chi phí/tải, thiết bị thật và khôi phục dữ liệu giả.

## Bộ ca bắt buộc khi triển khai tính năng tương ứng

1. AC-01/08: hai dòng họ độc lập; người chưa đăng nhập; thành viên bị thu hồi; đổi ID; tự nâng quyền; client gọi thẳng dữ liệu; token khách hết hạn/thu hồi; không lộ trường riêng tư.
2. AC-02/03: người không có account; ngày chỉ có năm; con nuôi/tái hôn; quan hệ tự trỏ/vòng lặp; hai chỉnh sửa đồng thời và hai quan hệ đồng thời tạo chu trình.
3. AC-04: fixture lịch âm có nguồn đối chiếu độc lập với thư viện đang test; tháng nhuận, ngày 30 thiếu, chuyển năm, thiếu ngày/năm và nhiều múi giờ. Không tự dùng kết quả của hàm đang test làm expected.
4. AC-05/09: đổi lịch, hủy, công bố sát ngày, job chạy lại, retry lỗi gửi, token push hỏng, từ chối quyền và thiết bị không hỗ trợ. Xác nhận không gửi cho thành viên đã rời.
5. AC-06: accept lặp/đồng thời, yêu cầu hết hạn, đổi chủ sự khi request còn pending, người nhận bị thu hồi membership và kết thúc ủy quyền sự kiện.
6. AC-07: RSVP theo hộ, sửa số người, double-submit, retry, số âm/thập phân, quá hạn, sự kiện hủy và nhóm khách khác nhau.
7. AC-10: tải trước rồi mất mạng, chưa tải dữ liệu, cache cũ, logout offline, đổi account, kết nối lại sau thu hồi quyền; không có ghi đang chờ đồng bộ.
8. AC-11: xuất và phục hồi vào môi trường thử; kiểm số lượng, ID, quan hệ và quyền. Sao lưu thành công chưa đủ nếu chưa khôi phục thử.

## Trình duyệt và khả năng tiếp cận

Trước pilot kiểm tra Android/Chrome và iPhone/Safari/PWA trên phiên bản được ghi trong báo cáo; không suy rộng từ desktop. Thử tăng cỡ chữ, bàn phím, độ tương phản, màn hình nhỏ, vùng chạm và phương án danh sách thay cây.

## Kết quả xác minh

Báo ngắn gọn trong câu trả lời: kiểm tra đã chạy, kết quả và hạn chế liên quan. Không tạo file báo cáo hoặc lưu output/log kiểm thử riêng trừ khi được yêu cầu. Chỉ ghi passed khi có bằng chứng; nếu tooling chưa tồn tại, nói rõ chưa thiết lập.

Lịch giỗ hiện kiểm thử Tet 2026, 29 tháng Chạp 2025 (đối chiếu lịch nghỉ tại thanglong.chinhphu.vn), tháng 2 nhuận 2023 (sự kiện có ngày âm/dương tại phatgiaonguyenthuy.com), ngày 30 thiếu, thiếu năm và 29/02. Browser suite xem lịch từ America/New_York; API thử giờ mùa hè thiếu/trùng, hạn quá giờ, khóa sự kiện duy nhất, xác nhận cũ, chuyển giao đồng thời, hết hạn, rời/tham gia lại và thu hồi ủy quyền. Push nền/nhận trên thiết bị thật chưa được kiểm chứng; chưa thay thế QA Android/Safari thật hoặc bộ đối chiếu trước pilot.

Luồng link đăng ký có kiểm thử API/rules cho preview tối thiểu, chờ duyệt không có membership, cô lập clan, giả mạo vai trò, gửi lặp, duyệt/rút đồng thời, link hết hạn/thu hồi và không ghi đè quyền đã có. Browser suite thử nhiều tài khoản chung link, duyệt từng người, thay link và đăng ký lại, axe/320px/chữ 200%.

Bàn giao quản trị có ca API cho admin cuối, người tạo hạ quyền/rời/bị gỡ, tự nâng quyền và truy cập chéo clan, thao tác cũ sau đổi vai trò/rời–tham gia lại, hai admin đồng thời hạ quyền/rời/gỡ nhau. Rules chặn trực tiếp mọi đổi/xóa membership và giả mạo lock; browser kiểm tra xác nhận, đóng thao tác hạ quyền khi offline, mất quyền sau bàn giao/rời và giữ nguyên hồ sơ.

Thiệp/RSVP: API thử DTO tối thiểu, link view/reply tách biệt, ID giả/cross-clan, phản hồi 4→3, retry và hai người sửa cùng hộ, số âm/thập phân/0, hạn phản hồi, ghi thay cần lý do, cấp lại giữ phản hồi, nguồn ngày/epoch cũ, hủy/hoàn tất. Rules chặn trực tiếp tokens/settings/groups cho cả admin. Browser thử xuyên luồng từ sự kiện đến khách không đăng nhập, sửa tổng, đổi lịch, cấp lại/hủy, offline và axe/320px/chữ 200%.

Bước 6: unit kiểm tra schema whitelist/ID/tham chiếu/vòng lặp, ngày thiếu/lịch gốc và mốc 7/3 qua DST. API có concurrent scan, retry hữu hạn, lỗi cuối, hủy/đổi revision, bỏ công bố muộn/chưa xác nhận, epoch rời–tham gia lại và mất quyền giữa claim/delivery; khôi phục thử riêng/idempotency/không ghi đè và round-trip 2.500 hồ sơ. Rules chặn job/inbox/session và chiếm prefix staging.

test:offline dùng bản build + service worker thật trên Edge desktop/mobile giả lập: tải chủ động, offline reload/chỉ đọc, logout offline/xóa cache, mất quyền khi nối lại, đổi tài khoản, JSON qua UI, tìm trong 1.000 hồ sơ, thông báo chung/chống trùng/tắt quyền, axe/320px/chữ 200%. Quyền denied được mô phỏng có chủ đích, không chứng minh thao tác cài đặt quyền trên điện thoại thật. Không coi số đo Emulator/browser giả lập là SLA thiết bị thực tế. Android/iPhone thật, FCM foreground/background/killed app, token hết hạn, cập nhật app đang nhập form, backup toàn bộ hạ tầng và thử dùng với người lớn tuổi vẫn phải kiểm tra trước pilot.

Cây lớn: `npm run test:feature -- genealogy` gồm luồng CRUD/quyền hiện có và gia phả 5.000 người giả trên Edge desktop/mobile giả lập: mở/thu nhánh, zoom/pan, tìm không dấu, định vị, giữ gốc khi xem hồ sơ, số thẻ DOM theo viewport, axe/320px/chữ 200%. Unit layout dùng 250/5.000/20.000 người và chuỗi 5.000 đời; kiểm tra snapshot realtime/cache/quyền và import trên 1.000 hồ sơ. Không suy rộng các số này thành SLA cloud hay thiết bị thật.

Tài khoản/mời theo số (AC-01c): unit chuẩn hóa 0/+84; API thử trùng số đồng thời, mời trước/sau đăng ký, DTO tối thiểu, Auth identity, admin xác nhận, version/idempotency, role/epoch cũ, số được cấp lại và hồ sơ/creator mất hiệu lực. Rules chặn accounts/phoneClaims/serverSecrets/personContacts/membershipInvites trực tiếp và chặn nhận link để tự tạo membership. Browser auth dùng Google popup thật của Emulator rồi hoàn tất số, nhận/duyệt từ cây, axe/320px/chữ 200% và logout. Đây là Google giả lập; OAuth Google thật và kiểm thử thiết bị thật vẫn là mốc riêng.

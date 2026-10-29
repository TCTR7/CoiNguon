# Thiết lập và phát triển

## Chạy local

Node đã kiểm chứng: 22.14.0, npm; dùng package-lock.json và npm ci khi cài lại.

- npm ci: cài dependency đã ghim.
- npm run dev: chạy frontend http://127.0.0.1:5173 và API gia phả/lịch giỗ local http://127.0.0.1:8787. Dùng cổng 5173 cho CORS; nếu cổng bận, dừng phiên dev cũ.
- npm run api: chỉ chạy API riêng (không chạy đồng thời với npm run dev).
- npm run build / npm run preview: build và xem bản build local.
- npm run typecheck / npm run lint / npm run format:check: kiểm tra tĩnh.
- npm run test:all: chạy toàn bộ unit/API/rules/browser, tự build PWA và quản lý dịch vụ; thêm -- --headed để mở Edge desktop/mobile giả lập. Dừng ngay khi có bộ lỗi.
- npm test: kiểm thử UI mẫu, ngày dân sự, lịch âm và đồ thị.
- npm run test:e2e: kiểm thử desktop và mobile giả lập bằng Edge đã cài. CI hiện chạy lint/unit/build/API/rules, chưa chạy browser suite.

Các trang /gia-pha, /lich-gio và /thiep-moi vẫn là mẫu, phản hồi chỉ giữ trong phiên. /dong-ho có đăng ký/đăng nhập local, tạo/chọn dòng họ, mời, đổi vai trò và gỡ thành viên. Dùng email giả .test và mật khẩu thử ít nhất 8 ký tự; chưa có đăng nhập cloud. PWA/offline chỉ có đầy đủ trên bản build; dev hỗ trợ chuyển sang đọc bản đã tải trong trang đang mở.

Automation tổ chức theo tính năng trong [automation_test/README.md](../automation_test/README.md). Ví dụ: npm run test:feature -- auth hoặc npm run test:feature -- genealogy. Thêm --headed (ví dụ npm run test:feature -- auth --headed) để mở Edge desktop chạy tuần tự; --list chỉ liệt kê ca, không khởi động dịch vụ. npm run test:api chạy tất cả API; test:genealogy giữ làm alias. Config test nằm trong automation_test/; output browser ở automation_test/artifacts/ và không commit.

## Firebase Emulator

- npm run emulators: khởi động Auth 9099, Firestore 8080, Storage 9199; UI tại http://127.0.0.1:4000.
- npm run emulators:check: kiểm tra khởi động cả ba dịch vụ rồi dừng.
- npm run test:rules: chạy Firestore và kiểm thử cô lập dòng họ, vai trò và lời mời nguyên tử rồi dừng.
- npm run test:workspace: khởi động Auth/Firestore, chạy browser suite hai tài khoản và dừng emulator; không chạy đồng thời với test:rules trên cùng cổng.
- Launcher cố định project demo-coinguon, chỉ bind loopback. Workspace /dong-ho kết nối emulator; API bắt buộc kiểm tra token và membership hiện tại.
- Cần Java 21+. Trên Windows có thể chạy powershell -File scripts/setup-java.ps1 để tải JRE từ Adoptium, kiểm SHA-256 và giải nén vào .tools/java; launcher tự nhận, không đổi Java toàn máy. Lần đầu emulator cần mạng để tải runtime.

## Cấu trúc và quy ước

src/app: layout/router; src/features: màn hình từng miền; src/shared: dữ liệu giả và UI chung; automation_test/features: page object và browser/API/rules theo tính năng; scripts: công cụ local. Đọc phần PRD/kiến trúc liên quan trước khi triển khai tính năng. Giữ UI, nghiệp vụ, quyền và test cùng phạm vi thay đổi.

TypeScript strict; tên code bằng tiếng Anh, UI bằng tiếng Việt. Giữ ngày lịch khác timestamp; không nuốt lỗi. Font được phục vụ local từ dependency, không gọi CDN font.

.env.example chỉ chứa cấu hình mẫu cho bước tích hợp sau. Mọi biến frontend đều có thể bị đọc; không đưa secret hoặc khóa dịch vụ vào đó. Không commit dữ liệu thật, credential, .tools hoặc output build/test.

Kiểm tra thay đổi có sẵn trước khi sửa; giữ nguyên phần không liên quan. Chạy kiểm tra phù hợp, báo ngắn kết quả và hạn chế. PROJECT_STATE tối đa 10 dòng, chỉ thay snapshot khi tiến độ/bước tiếp theo/vướng mắc thay đổi. Không tạo lịch sử triển khai.

Để dùng thử: mở hai terminal chạy npm run emulators và npm run dev, sau đó vào /dong-ho. Tạo hai tài khoản giả trong hai cửa sổ trình duyệt riêng để thử lời mời. Để bàn giao: cấp admin cho tài khoản thứ hai, sau đó hạ vai trò của mình (có xác nhận) hoặc chọn Rời gia phả. Nút này bị khóa với admin cuối; API kiểm tra lại nguyên tử, kể cả nếu gọi trực tiếp. Dữ liệu còn khi reload trình duyệt trong cùng phiên emulator; mặc định emulator không lưu qua lần khởi động lại. Đây không phải cơ chế sao lưu.

Gia phả local nằm trong /dong-ho: tạo/sửa hồ sơ, ngày gốc thiếu thông tin, quan hệ, đề nghị liên kết/sửa và lưu trữ/khôi phục. npm run test:genealogy khởi động Auth/Firestore và kiểm thử API; chạy riêng, không cùng lúc với test:rules hoặc test:workspace trên các cổng mặc định. npm run test:workspace bao gồm cả luồng trình duyệt gia phả.

Lịch giỗ local trong /dong-ho: thêm hồ sơ Đã mất → thiết lập quy tắc → phân công chủ sự → tạo sự kiện năm → đối chiếu ngày, nhập giờ/địa điểm/hạn phản hồi → công bố trong dòng họ. Chuyển chủ sự/ủy quyền cần tài khoản người nhận đồng ý; thiệp khách có luồng riêng bên dưới; worker local hiện ghi hộp nhắc, chưa gửi push nền. test:genealogy hiện chạy cả API lịch giỗ, đăng ký và quản trị thành viên; test:workspace bao gồm lịch và khả năng tiếp cận. Không chạy các bộ emulator đồng thời.

Đăng ký qua link chung: trong /dong-ho, admin chọn “Tạo link đăng ký”, sao chép link và mở bằng cửa sổ/tài khoản thử khác. Gửi lời giới thiệu → admin “Duyệt tham gia” → người gửi vào gia phả. Link local hạn 30 ngày, có thể thay/thu hồi; địa chỉ loopback chỉ dùng trên máy đang chạy, chưa chia sẻ cho người thân dùng qua Internet. test:genealogy chạy cả API đăng ký, test:workspace chạy cả UI đăng ký.

Thiệp/RSVP local: chọn sự kiện tương lai đã công bố → mở “Thiệp mời & phản hồi theo hộ” → soạn, xem trước và đồng ý công bố thiệp → tạo link riêng từng hộ. Mở /loi-moi#token bằng cửa sổ khác, không đăng nhập, gửi/sửa số người trước hạn. Người quản lý xem tổng, ghi thay sau hạn kèm lý do, thu hồi/cấp lại link. Link loopback chỉ dùng trên máy hiện tại, chưa có dịch vụ Internet. test:genealogy gồm API thiệp; test:workspace gồm thiệp desktop/mobile giả lập và offline.

## Thử Bước 6 local

- Chạy Emulator ở một terminal. Chạy npm run build rồi npm run preview:workspace ở terminal khác: bản build tại 127.0.0.1:5173 và API 8787. Không chạy đồng thời dev/API khác. npm run preview đơn lẻ không khởi động API.
- Trong /dong-ho: “Dữ liệu & thiết bị” → xác nhận thiết bị riêng → tải → mở /ngoai-tuyen. Mở online một lần để worker chuẩn bị app shell, sau đó thử mất mạng và reload. Bản tải không tự cập nhật theo dữ liệu mới; tải lại chủ động. Đăng xuất xóa bản tải, không xóa file JSON đã tải về.
- Admin mở “Xuất bản sao & khôi phục thử” → xuất JSON hoặc chọn tệp → kiểm tra số lượng → xác nhận tên gia phả thử → khôi phục. Gia phả mới xuất hiện trong bộ chọn; kiểm tra hồ sơ/quan hệ/ngày, phân công chủ sự và xác nhận lịch trước khi công bố. Chỉ dùng dữ liệu giả; hiện mọi endpoint cố định Emulator.
- “Hộp nhắc giỗ” đọc lời nhắc; admin có nút quét/xem trạng thái. Worker chỉ chạy khi API còn hoạt động; mốc công bố đã qua không gửi bù. Test thời gian tương lai/retry dùng clock tiêm nội bộ trong API suite, không có endpoint đổi clock.
- Thông báo thử cần build PWA + trình duyệt hỗ trợ + cấp quyền; có thể tắt tại UI. Từ chối quyền vẫn dùng lịch/thiệp bình thường. Chưa có FCM push nền hoặc gửi mạng xã hội.
- npm run test:genealogy: toàn bộ API, gồm worker và khôi phục 1.000 hồ sơ; npm run test:rules: rules; npm run test:offline: browser trên bản build đã có trong dist, kiểm tra offline reload/quyền/cache/thông báo. Không chạy các bộ Emulator cùng lúc hoặc để dev chiếm 5173/8787.

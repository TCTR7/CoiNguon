# Kế hoạch triển khai Cội Nguồn

Trạng thái: kế hoạch hiện hành; bước triển khai hiện tại xem PROJECT_STATE.md. Đây là kế hoạch hiện hành, không phải nhật ký. Tiến độ ngắn gọn nằm tại [PROJECT_STATE.md](ai_agents/PROJECT_STATE.md); nghiệp vụ và AC nằm tại [PRD](PRD_CoiNguon_App.md).

## Mục tiêu và cách làm

Hoàn thành luồng: tạo dòng họ → nhập gia phả → tạo lễ giỗ → chia sẻ thiệp → tổng hợp người tham dự.

Mỗi bước triển khai UI, nghiệp vụ, quyền truy cập và kiểm thử cùng nhau. Chọn phiên bản dependency và kiểm tra tài liệu chính thức khi bắt đầu phần liên quan. Không cần chốt mọi thư viện trước scaffold. Không mở rộng sang quỹ, thanh toán hoặc dịch vụ trong MVP.

## 1. Nền ứng dụng và hướng UI

- Baseline đề xuất: React + TypeScript + Vite + Tailwind; chọn phiên bản tương thích khi scaffold.
- Tạo cấu trúc theo tính năng, điều hướng di động và thành phần dùng chung.
- Thiết lập Firebase Emulator, dữ liệu gia đình giả và kiểm tra tự động nền tảng.
- Dựng ba màn hình mẫu theo hướng UI bên dưới: Tổng quan, Hồ sơ người, Thiệp mời/RSVP. Dùng chúng để kiểm chứng chữ, màu và thao tác trước khi nhân rộng.
- Khung điều hướng gồm Tổng quan, Gia phả, Lịch giỗ, Thành viên; Cài đặt trong menu tài khoản.

Hoàn thành khi: chạy local và điều hướng trên màn hình nhỏ được; build/typecheck và kiểm thử nền tảng đạt; ba màn hình mẫu thể hiện nhất quán bản sắc và khả năng tiếp cận. Màn hình mẫu dùng dữ liệu giả phải được phân biệt với tính năng đã tích hợp.

## 2. Đăng nhập, dòng họ và phân quyền — FR-01

- Đề xuất Google cho đăng nhập đầu tiên, tài khoản giả lập khi phát triển local; giải quyết OQ-01 trước tích hợp đăng nhập thật.
- Tạo/chọn dòng họ, mời và quản lý thành viên.
- Áp dụng quản trị viên, biên tập viên và thành viên tại lớp dữ liệu/backend.
- Chốt tập trường riêng tư OQ-04 trước thiết kế schema hồ sơ.

Hoàn thành khi: đạt AC-01; không truy cập chéo dòng họ, tự nâng quyền hoặc loại bỏ quản trị viên cuối cùng.

## 3. Hồ sơ và cây gia phả — FR-02

- Làm danh sách, tìm kiếm và form hồ sơ trước, sau đó sơ đồ cây.
- Tách hồ sơ khỏi tài khoản; hỗ trợ ngày thiếu dữ liệu, con nuôi, tái hôn và cha/mẹ chưa rõ.
- Thêm đề nghị nhận hồ sơ/sửa thông tin, chống ghi đè đồng thời, xóa mềm và khôi phục.
- Kiểm chứng thư viện cây bằng quan hệ phức tạp trước khi chọn; hỗ trợ xem một nhánh thay vì tải toàn bộ.

Hoàn thành khi: đạt AC-02/03; nhập và tìm được gia phả, chặn vòng lặp kể cả khi ghi đồng thời.

## 4. Lịch giỗ và chủ sự — FR-03/04

- Kiểm chứng lịch âm bằng dữ liệu đối chiếu độc lập; giải quyết OQ-02.
- Tách ngày mất, quy tắc giỗ và ngày tổ chức; hiển thị rõ ngày chưa xác nhận.
- Tạo/công bố/đổi lịch/hủy/hoàn tất sự kiện.
- Gán chủ sự, chuyển quyền có xác nhận và ủy quyền theo sự kiện.

Hoàn thành khi: đạt AC-04/06; đúng ngày, đúng người phụ trách, chuyển quyền không thực hiện lặp.

## 5. Thiệp mời và RSVP — FR-05

- Xem trước và chia sẻ thiệp; tách link xem chung khỏi link phản hồi theo hộ.
- Nhập số người lớn/trẻ em, sửa trước hạn, tổng hợp phản hồi và gợi ý số mâm.
- Thu hồi/cấp lại link, xử lý hết hạn/hủy sự kiện; chốt OQ-05 trước phát hành link khách.

Hoàn thành khi: đạt AC-07/08 và chạy xuyên suốt luồng MVP; phản hồi lặp không cộng trùng, khách không truy cập dữ liệu nội bộ. Đây là mốc demo đầu tiên để dùng thử toàn luồng.

## 6. Nhắc giỗ, offline và pilot — FR-06/07

- Tác vụ nhắc 7/3 ngày, đổi lịch, retry và chống trùng; tích hợp push và hướng dẫn cấp quyền.
- Tải hồ sơ/lịch để đọc offline, chặn ghi và xóa cache khi đăng xuất.
- Hoàn thiện xuất dữ liệu, sao lưu và thử khôi phục trên môi trường riêng.
- Kiểm tra Android/iPhone, 1.000 hồ sơ giả, mất mạng, mất quyền, bàn phím và phóng to chữ.
- Chốt ngân sách/region/hạn mức OQ-03 và chính sách dữ liệu trước cloud trả phí hoặc pilot dữ liệu thật.

Hoàn thành khi: đạt AC-05/09/10/11, không hồi quy các AC trước và có bằng chứng kiểm tra thiết bị thực tế. Deploy cần phạm vi cho phép riêng.

## Định hướng UI: Gia phả đương đại

Yêu cầu của chủ dự án: frontend có bản sắc đặc biệt, dễ tiếp cận. Hướng thiết kế đề xuất là cảm giác một cuốn gia phả được gìn giữ qua nhiều thế hệ, thể hiện bằng bố cục hiện đại, ấm áp và điềm tĩnh. Kiểm chứng bằng ba màn hình mẫu ở bước 1; không coi bảng màu/font đề xuất là quyết định không thể thay đổi.

### Bản sắc thị giác

- Nền giấy ngà, chữ nâu mực đậm; đỏ son trầm làm màu hành động chính, xanh lá sâu làm điểm nhấn phụ. Chốt mã màu sau khi kiểm tra tương phản.
- Tiêu đề có thể dùng serif hỗ trợ đầy đủ dấu tiếng Việt, nội dung và form dùng sans-serif rõ nét; tối đa hai họ chữ, tải nhẹ.
- Đường nối gia phả, đường viền mảnh và họa tiết Việt tiết chế tạo dấu ấn; chỉ dùng trang trí ở vùng không ảnh hưởng đọc nội dung. Tránh chữ thư pháp cho dữ liệu hoặc nút thao tác.
- Ảnh gia đình và tên người là trọng tâm; khoảng trắng rộng, phân cấp chữ rõ. Không mặc định biến trang tổng quan thành một dãy thẻ KPI.
- Chuyển động ngắn, nhẹ, có hỗ trợ giảm chuyển động; không tự phát nhạc, không dùng hiệu ứng che nội dung.

### Bố cục theo việc người dùng cần làm

- Tổng quan: tên dòng họ, lễ giỗ gần nhất và việc cần phản hồi; hành động chính rõ ràng, thay đổi theo quyền người dùng.
- Gia phả: tìm người nổi bật, chuyển Danh sách/Cây, xem nhánh và nút trở về người đang chọn. Không bắt buộc thao tác kéo/thu phóng để tìm thông tin.
- Hồ sơ: tên, ảnh, ngày sinh/mất dễ đọc; quan hệ gia đình và tiểu sử ở các phần rõ ràng. Nút sửa chỉ xuất hiện với người có quyền.
- Lịch giỗ: hiển thị cả ngày âm và dương kèm nhãn, người chủ sự và trạng thái xác nhận; không dùng màu đơn độc để báo tình trạng.
- Thiệp/RSVP: trang trang trọng, ít nhiễu, thời gian/địa điểm rõ; dùng câu hỏi “Gia đình mình có tham dự không?” và nút trả lời bằng tiếng Việt thay cho thuật ngữ RSVP trên UI.

### Dễ tiếp cận là điều kiện hoàn thành

- Nội dung chính bắt đầu từ 18px trên di động; không dùng chữ nhỏ hoặc xám nhạt cho thông tin quan trọng. Cho phép phóng to chữ 200% mà không mất nội dung/chức năng.
- Vùng chạm mục tiêu tối thiểu 44×44 CSS px, có khoảng cách; icon đi cùng nhãn ở hành động chính.
- Mục tiêu tương phản: tối thiểu 4.5:1 cho chữ thường, 3:1 cho chữ lớn; kiểm tra trạng thái focus và điều khiển trên nền thực tế.
- Dùng semantic HTML, label cho input, focus rõ, hỗ trợ bàn phím và thông báo lỗi có thể được công nghệ hỗ trợ đọc.
- Form chia nhóm ngắn, có ví dụ ngày tháng; không mất dữ liệu đã nhập khi gặp lỗi. Hành động xóa có xác nhận rõ hậu quả.
- Thiết kế đủ loading, rỗng, lỗi, không có quyền, offline và thành công. Người dùng luôn biết việc đã lưu hay chưa.
- Kiểm tra ở chiều rộng 320px trở lên; chỉ vùng sơ đồ được phép có thao tác pan, trang không cuộn ngang ngoài ý muốn.
- Dùng thử các việc tìm người, xem ngày giỗ và xác nhận tham dự với người lớn tuổi trước pilot; ghi nhận chỗ mắc để sửa, không suy đoán chỉ từ giao diện đẹp.

## Quản lý tiến độ

PROJECT_STATE.md chỉ giữ bước hiện tại, việc tiếp theo và vướng mắc trong tối đa 10 dòng. Không lưu lịch sử triển khai hoặc tạo báo cáo riêng. Kế hoạch này chỉ sửa khi phạm vi hoặc thứ tự triển khai thay đổi.

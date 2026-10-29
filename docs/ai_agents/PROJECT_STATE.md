# Trạng thái dự án

- Hiện tại: Bước 6 local hoàn tất; automation_test/ đã tổ chức theo tính năng, pages/tests, common_setup và artifacts.
- Kiểm tra: 84 API, 23 rules, 1 auth headed đạt với biến Path Windows; lint/format runner đạt.
- Setup: test:all tự build/chạy tuần tự; --headed giữ desktop/mobile với 1 worker; test:feature chọn từng tính năng.
- Runner: giữ Path khi thêm Java, gọi CLI test cục bộ; browser mở sau Unit/API/Rules/Build; chưa chạy lại toàn bộ headed.
- Tiếp theo: chốt OQ-01..05, cấu hình push/backup cloud, kiểm tra lifecycle PWA và QA Android/Safari thật trước pilot.
- Giới hạn: Emulator/loopback; chưa FCM push nền/backup toàn bộ hạ tầng/dữ liệu thật/browser CI; chunk Firebase còn lớn.

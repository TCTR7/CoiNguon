# Trạng thái dự án

- Code: backend tách local/cloud, Firebase Admin ADC, project/origin/PORT và secret HMAC qua môi trường.
- Web: API cấu hình chung /api khi cloud; Google thật, không có form password thử trong cloud.
- Phát hành: Dockerfile, Hosting/index manifests và build:cloud đã có; chưa deploy tài nguyên thật.
- Kiểm tra: 82 unit, 101 API, 25 Rules, 42 browser workspace và 8 PWA đạt; typecheck/lint đạt.
- Container: build và startup cloud bằng dependencies production đạt, không chứa .env.local, chặn mạng ngoài.
- Local: test/build:local ép demo, PWA từ chối build cloud qua build-target.json; không sửa .env.local.
- Tiếp theo: phát hành staging và nghiệm thu OAuth/IAM/index, scheduler, thiết bị thật trước pilot.
- Giới hạn: chưa FCM nền; audit runtime 10 cảnh báo (4 high/6 moderate), cần rà soát trước production.

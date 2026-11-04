# Automation test — Cội Nguồn

Chạy lệnh từ thư mục gốc dự án. Browser dùng Playwright TypeScript, API/rules dùng Vitest và Firebase Emulator; dependency dùng chung package.json gốc.

## Cấu trúc

```text
automation_test/
├── common_setup/            # Fixture, dữ liệu giả, setup dùng chung
├── features/
│   ├── auth/                # Google giả lập, số duy nhất, mời theo số, đăng xuất
│   ├── clan_membership/     # Dòng họ, vai trò và bàn giao
│   ├── clan_joining/        # Link chung và duyệt tham gia
│   ├── genealogy/           # Hồ sơ và quan hệ
│   ├── memorial_calendar/   # Lịch giỗ và chủ sự
│   ├── invitations/         # Thiệp và phản hồi theo hộ
│   ├── offline_backup/      # PWA, offline, nhắc và khôi phục
│   ├── ui_quality/          # UI mẫu và accessibility
│   └── security_rules/      # Cô lập dữ liệu và quyền truy cập
├── artifacts/               # Output cục bộ, không commit
├── scripts/                  # run-feature.mjs, run-all.mjs
├── playwright.config.ts
├── playwright.workspace.config.ts
├── playwright.offline.config.ts
├── vitest.api.config.ts
└── vitest.rules.config.ts
```

Mỗi tính năng có UI theo cấu trúc:

```text
features/genealogy/
├── pages/GenealogyPage.ts       # Selector và thao tác dùng lại
└── tests/
    ├── genealogy.spec.ts        # Kịch bản browser
    └── genealogy.api.test.ts    # Kiểm thử API
```

Security rules chỉ có tests/, không tạo page object cho phần không có UI. Unit test nhỏ vẫn giữ cạnh mã trong src/.

## Chạy test

Cần npm ci, Java 21+ và Edge theo [DEVELOPMENT.md](../docs/DEVELOPMENT.md). Dừng dev/API/emulator cũ trước khi chạy bộ tự khởi động dịch vụ; không chạy các bộ Emulator cùng lúc.

```bash
npm run test:all             # Toàn bộ unit/API/rules/browser; tự build PWA
npm run test:all -- --headed # Toàn bộ test; mở Edge desktop và mobile giả lập

npm run test:feature -- auth
npm run test:feature -- genealogy
npm run test:feature -- clan_joining
npm run test:feature -- invitations

npm run test:workspace      # Các luồng thật, gồm auth
npm run test:e2e            # UI mẫu và accessibility
npm run test:api            # Toàn bộ API
npm run test:rules          # Firestore Rules
npm test                   # Unit/UI trong src/

npm run build
npm run test:offline        # PWA trên bản build
npm run test:feature -- offline_backup
```

test:all chạy tuần tự unit → API → rules → build → workspace → PWA → UI mẫu; dừng tại bộ lỗi đầu tiên và trả mã lỗi. Không cần mở dịch vụ hoặc build riêng. Cờ --headed chỉ áp dụng cho browser, chạy một worker nhưng vẫn giữ cả desktop và mobile giả lập; unit/API/rules không mở cửa sổ. Browser chỉ mở sau khi Unit/API/Rules/Build hoàn tất, có thể mất vài phút.

test:feature chạy browser của tính năng được chọn; tên tính năng như cây thư mục, trừ security_rules dùng test:rules. ui_quality chạy màn mẫu; offline_backup cần build trước. test:genealogy là alias cũ của test:api.

Các bộ browser chạy Edge desktop và mobile giả lập. playwright.config.ts ở gốc chỉ chuyển tiếp để lệnh npx playwright test vẫn chạy bộ UI mẫu; cấu hình chính nằm trong automation_test/. Xem danh sách trước khi chạy:

```bash
npx playwright test --config automation_test/playwright.workspace.config.ts --list
```

### Mở browser để quan sát

Mặc định test chạy headless: browser vẫn thực thi nhưng không hiện cửa sổ. Với test:feature, thêm --headed để tự mở Edge desktop và chạy một worker; runner vẫn tự khởi động Emulator/API/frontend và dừng khi xong. Không cần mở npm run dev hay npm run emulators riêng. Browser thường đóng ngay khi ca kết thúc.

```bash
npm run test:feature -- auth --headed
npm run test:feature -- genealogy --headed
npm run test:feature -- auth --list
```

--list chỉ liệt kê ca, không khởi động Emulator/API/frontend hoặc browser. Có thể kết hợp --headed --list để xem bộ desktop được chọn. Chạy không có --headed vẫn giữ cả desktop và mobile giả lập. Runner chỉ nhận tên tính năng và hai cờ này; offline_backup vẫn cần npm run build trước.

## Viết test

- pages/ giữ selector và thao tác dùng lại; tests/ giữ kịch bản và assertion nghiệp vụ. Locator dùng riêng cho một khẳng định có thể nằm trong test.
- AuthPage và common_setup/fixtures.ts cung cấp thao tác/fixture đăng nhập. Mỗi ca dùng email .test và dữ liệu giả riêng; tài khoản thứ hai dùng tab hoặc browser context phù hợp.
- Tên file: *.spec.ts cho browser, *.api.test.ts cho API, *.rules.test.ts cho rules. Đổi đường dẫn phải cập nhật runner, TypeScript, lint/format và dùng --list để kiểm tra không mất hoặc chạy trùng ca.
- Không tạo nhật ký triển khai. artifacts/ chỉ chứa output tự sinh phục vụ debug, không commit và không dùng dữ liệu gia đình thật.

CI hiện cấu hình lint, unit, build, API và rules qua script npm. Browser chưa được nối vào CI; mobile giả lập không thay thế QA Android/iPhone thật.

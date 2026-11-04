# Hướng dẫn deploy Cội Nguồn

Đối chiếu source và tài liệu dịch vụ ngày 30/10/2026. Các lệnh bên dưới dùng PowerShell, chạy từ thư mục gốc repo.

## 1. Đọc trước: hiện tại deploy được đến đâu?

**Repo hiện chạy đầy đủ bằng Emulator trên máy phát triển; chưa có adapter và cấu hình để deploy ứng dụng đầy đủ lên cloud.** Tài liệu này mô tả trình tự từ hoàn thiện adapter đến triển khai môi trường thử và phát hành pilot. Phải hoàn tất mục 3 trước khi chạy các bước cloud. Chỉ upload `dist/` hiện tại sẽ mở được giao diện nhưng đăng nhập và thao tác dữ liệu vẫn gọi localhost trên máy người truy cập.

Các điểm đã kiểm tra trong source:

- `src/shared/firebase/client.ts`: cố định project `demo-coinguon`, luôn kết nối Auth 9099 và Firestore 8080.
- `backend/service.ts`: tự gán hai biến Emulator, khởi tạo Admin SDK cho project demo.
- `backend/server.ts`: bind `127.0.0.1:8787`, kiểm tra Host/Origin local, chưa đọc `PORT` của cloud.
- Các client API trong `src/features/` còn gọi `http://127.0.0.1:8787`.
- `backend/accounts.ts`: khóa HMAC lưu trong Firestore phục vụ local; limiter nằm trong bộ nhớ.
- `backend/reminders.ts`: worker chạy trong tiến trình API, chưa có scheduler cloud. Thông báo thiết bị hiện là thử local, chưa có FCM push nền.
- `firebase.json` chưa có Hosting; chưa có Dockerfile hoặc manifest index cloud. `.env.example` hiện chỉ là placeholder, thay project ID trong đó chưa làm app kết nối cloud.
- `.github/workflows/ci.yml` chỉ kiểm tra code, chưa tự deploy.

Hồi quy local gần nhất: build/typecheck, 42 ca browser workspace và 8 ca PWA đạt. **Chưa có bằng chứng deploy cloud hoặc Google OAuth thật thành công.** Kết quả local không thay thế các bước nghiệm thu ở mục 11.

Để chạy bản hiện có ngay, xem [DEVELOPMENT.md](DEVELOPMENT.md). Để đưa lên Internet có đăng nhập và lưu dữ liệu thật, đi lần lượt các mục dưới đây.

## 2. Đích triển khai và thông tin cần chuẩn bị

Hướng dẫn chọn phương án tham chiếu **Firebase Hosting + Cloud Run + Firebase Auth + Firestore** để giữ cấu trúc React/Vite và HTTP backend hiện tại. Đây là phương án đề xuất để triển khai, chưa phải quyết định cloud đã được chủ dự án duyệt.

- Hosting phục vụ `dist/`, HTTPS và điều hướng SPA.
- Hosting chuyển `/api/**` đến Cloud Run; frontend gọi API cùng origin.
- Google đăng nhập qua Firebase Auth. Firestore Rules tiếp tục kiểm soát các thao tác trực tiếp từ client; backend vẫn tự kiểm tra quyền.
- Secret Manager giữ khóa HMAC tra số điện thoại.
- Nhắc định kỳ cần Cloud Scheduler gọi worker riêng có IAM bảo vệ. FCM là phần tích hợp riêng, không tự xuất hiện sau khi deploy.
- Chưa mở upload ảnh: Storage Rules hiện từ chối mọi đọc/ghi; có thể giữ nguyên và chưa tạo bucket cho lần thử đầu.

Chuẩn bị và chốt trước khi tạo tài nguyên tính phí:

- Một Google account vận hành và project **staging riêng**, chỉ dùng dữ liệu gia phả giả. Production là project khác.
- Project ID thật, duy nhất; không bắt đầu bằng `demo-`. Ví dụ `coinguon-staging-THAY-MA-RIENG` chỉ là placeholder, phải thay toàn bộ bằng ID hợp lệ của bạn.
- Region Firestore và Cloud Run. Ví dụ dưới dùng `asia-southeast1`; cần xác nhận khả dụng, yêu cầu dữ liệu và chi phí trước khi chọn. Vị trí Firestore cần cân nhắc ngay lúc tạo database.
- Ngân sách tháng, email nhận cảnh báo, người theo dõi sự cố; chính sách lưu giữ/xóa dữ liệu trước pilot dữ liệu thật.
- Mốc đầu dùng domain `PROJECT_ID.web.app`; custom domain làm sau khi staging đạt.
- Quyền tài khoản triển khai để tạo dịch vụ, gán IAM và deploy Rules/Hosting. Nếu là project tổ chức, nhờ quản trị viên cấp quyền theo tác vụ; không cấp Owner cho tài khoản runtime của API.

Cloud Run trong phương án này cần billing/Blaze. Tự xác nhận gói, quota và giá đang áp dụng trong Console trước khi bật. Ngân sách chỉ cảnh báo không tự giới hạn chi tiêu; giới hạn instance cũng không phải trần tổng hóa đơn. Xem [budget alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## 3. Điều kiện bắt buộc trong code — hiện CHƯA hoàn tất

Mục này dành cho người hoàn thiện code trước khi người vận hành làm theo phần deploy. **Không tiếp tục mục 5–10 nếu các điều kiện này chưa đạt.** Các tên biến/file cấu hình cloud bên dưới là giao ước đề xuất, chưa được source hiện tại đọc.

### 3.1. Tách local và cloud rõ ràng

- Thêm cấu hình frontend theo `VITE_APP_ENV=local|staging|production`; local giữ Emulator hiện có. Cloud đọc web config Firebase thật, tuyệt đối không gọi `connectAuthEmulator`/`connectFirestoreEmulator`.
- Backend đọc `APP_ENV`, `FIREBASE_PROJECT_ID`; local mới gán các biến Emulator. Cloud từ chối khởi động nếu thiếu project, dùng project demo hoặc có `FIREBASE_AUTH_EMULATOR_HOST`/`FIRESTORE_EMULATOR_HOST`.
- Cloud dùng Admin SDK với Application Default Credentials của service account gắn vào Cloud Run. Không đóng gói service-account JSON; không có nhánh tự rơi về demo khi lỗi cấu hình. Xem [Admin SDK setup](https://firebase.google.com/docs/admin/setup).
- Kiểm tra frontend/backend cùng project và môi trường. Production không nhận token của staging.

### 3.2. Đổi các client API và HTTP server

Đưa URL API qua một cấu hình chung: local là `http://127.0.0.1:8787`, cloud là đường dẫn tương đối `/api`. Kiểm tra đủ:

- `src/features/workspace/accountService.ts` và `service.ts`.
- `src/features/genealogy/service.ts`, `anniversaries/service.ts`.
- `src/features/joining/service.ts`, `invitations/api.ts`.
- `src/features/preparedness/service.ts` sử dụng API thiệp, cần kiểm tra xuyên luồng offline/export/reminders.

Backend cloud phải nghe `0.0.0.0` trên `process.env.PORT`, xử lý Host qua proxy đúng cách và giới hạn Origin theo cấu hình. Giữ kiểm tra token, membership, version/idempotency và giới hạn request body; không thay kiểm tra quyền bằng CORS. Cloud Run yêu cầu giao diện/cổng như [container contract](https://docs.cloud.google.com/run/docs/container-contract).

Thêm `GET /api/health` trả tối thiểu `{ "mode": "staging", "projectId": "..." }`, không trả secret hoặc dữ liệu gia phả. `/health` hiện tại chỉ là endpoint local; lệnh nghiệm thu phía dưới dùng endpoint cloud mới này.

### 3.3. Google thật và khóa tra số

- Cloud chỉ cho Google identity trong luồng hoàn tất tài khoản; bỏ nhánh password `.test` khỏi cloud, giữ nó cho fixture local. UI cloud bỏ form/mô tả Google giả lập và thông báo kiểm tra Emulator.
- Giữ đăng nhập lại khi đổi số. Số điện thoại vẫn là tự khai, không được mô tả là đã được Google/SMS xác minh.
- Cloud đọc `PHONE_LOOKUP_HMAC_KEY` từ Secret Manager; không tạo secret ngẫu nhiên mới mỗi lần container chạy. Quy định định dạng: chuỗi hex 64 ký tự, được dùng nhất quán như cùng một chuỗi khóa giữa mọi revision.
- Không lưu khóa cloud tại `serverSecrets/phoneLookup`. Không đưa khóa vào frontend, log, JSON xuất hay image.
- Giữ khóa ổn định sau lần có dữ liệu đầu tiên. Đổi khóa làm thay phoneKey; cần kế hoạch di trú account/claim/invite và thử khôi phục riêng trước khi rotation. Tạo thêm secret version không tự giải quyết di trú.

### 3.4. Chống lạm dụng, truy vấn và tác vụ nền

- Thay limiter trong bộ nhớ bằng cơ chế dùng chung giữa các instance, có TTL/dọn dữ liệu; bảo vệ cả API khách/join preview, tài khoản và thao tác ghi. Chốt cách bảo vệ tạo account và ghi Firestore trực tiếp; nếu dùng App Check phải triển khai cả client và kiểm tra tương ứng, rồi nghiệm thu trước khi enforce.
- Rà soát mọi truy vấn, tạo `firestore.indexes.json`, cấu hình index trong manifest cloud. Chạy luồng thật trên staging để xác nhận index; không suy ra từ Emulator. Không tạo index rỗng rồi coi đã hoàn thành.
- Thêm `APP_ROLE=api|worker`: API không tự chạy vòng nhắc local; worker chỉ phục vụ đường nội bộ, không mở API người dùng.
- Worker cần `POST /internal/reminders/tick` gọi `runReminderTick()` với clock server, không nhận `now`, `fail` hoặc UID từ body. Deploy worker thành service riêng bắt buộc IAM, chỉ service account scheduler được gọi.
- Giữ transaction, lease, retry và chống trùng khi scheduler gửi lặp hoặc hai worker chạy cùng lúc. Quét toàn bộ clan/job hiện tại cần đo và chia lô nếu vượt thời gian xử lý.
- Hoàn thiện luồng nhắc cloud theo phạm vi phát hành: inbox và scheduler phải được kiểm chứng; FCM cần đăng ký thiết bị, thu hồi token/logout, quyền thông báo, retry và kiểm thử foreground/background/app đóng. Chưa có FCM thì chỉ được ghi nhận là bản staging thử tính năng đã có, chưa đạt pilot đầy đủ FR-06.

### 3.5. Tệp cần có trước khi bàn giao deploy

- Adapter frontend/backend và kiểm thử tách môi trường, token sai project, thiếu secret, không gọi localhost trong cloud.
- `Dockerfile`, `.dockerignore`, `firestore.indexes.json`, `firebase.staging.json` thực tế, khớp giao ước dưới đây.
- Giao ước cấu hình đã được code đọc: frontend ở mục 9; backend gồm `APP_ENV`, `APP_ROLE`, `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS`, `PHONE_LOOKUP_HMAC_KEY`, `PORT`.
- Chống lạm dụng dùng chung hoạt động với cấu hình thật đã chọn; bổ sung biến cần thiết cho cơ chế đó vào runbook. Các lệnh Cloud Run ở mục 8 là cấu hình nền, chưa thay thế cấu hình limiter/FCM phát sinh khi hoàn thiện adapter.
- Kết quả kiểm tra theo [TESTING.md](TESTING.md), gồm browser/PWA; container khởi động được với runtime chỉ có dependencies production.

Nếu giao phần này cho Codex, có thể dùng yêu cầu sau:

> Hoàn thiện điều kiện code tại mục 3 của docs/DEPLOYMENT.md cho staging Firebase Hosting + Cloud Run, giữ local Emulator. Chốt các lựa chọn cloud chưa rõ với tôi, cập nhật giao ước/lệnh trong tài liệu theo code cuối cùng. Chạy kiểm tra local và container phù hợp. Chỉ chuẩn bị source/cấu hình; chưa tạo cloud resource, bật billing hoặc deploy. Không coi ví dụ trong tài liệu là cấu hình đã tồn tại.

## 4. Chuẩn bị máy và kiểm tra local

Cần Node tương thích `package.json` (bản đã kiểm chứng của repo: 22.14.0), npm, Git, Java 21+ cho Emulator, Edge cho browser suite, Google Cloud CLI và Docker Desktop chạy **Linux containers**. Cài Google Cloud CLI theo [hướng dẫn chính thức](https://docs.cloud.google.com/sdk/docs/install), Docker theo [hướng dẫn Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

Kiểm tra công cụ:

```powershell
node --version
npm --version
git --version
gcloud version
docker version
npm ci
node node_modules/firebase-tools/lib/bin/firebase.js --version
```

Nếu chưa có Java phù hợp, repo có `powershell -File scripts/setup-java.ps1`; xem [DEVELOPMENT.md](DEVELOPMENT.md) về JRE portable. Firebase launcher nhận JRE portable này, không cần đổi Java toàn máy.

Kiểm tra bản code đã hoàn thiện adapter, lần lượt từng lệnh; lỗi thì dừng:

```powershell
npm run lint
npm run format:check
npm run test:all
```

`test:all` có build, unit/API/Rules/browser/PWA; không tự chạy lint/format. Các suite vẫn chạy local, không trỏ vào project cloud. Không chạy song song với phiên Emulator/dev khác dùng cùng cổng. Chưa có ca cloud tự động; phần smoke ở mục 11 thực hiện riêng.

## 5. Tạo Firebase staging và bật Google

Các bước từ đây tạo/thay đổi tài nguyên cloud và có thể phát sinh phí. Người vận hành thực hiện trên **staging** sau khi mục 3 đạt và ngân sách/region đã được chốt.

1. Mở [Firebase Console](https://console.firebase.google.com/), tạo project staging với ID đã chuẩn bị. Chưa cần bật Analytics cho bản thử này.
2. Trong Project settings → General → Your apps, thêm **Web app**. Ghi lại web config Firebase: `apiKey`, `authDomain`, `projectId`, `appId`. Đây là cấu hình client, không phải service-account secret.
3. Vào Authentication → Sign-in method, bật Google và chọn support email. Không bật Email/Password/Phone chỉ để chạy fixture; fixture phải ở Emulator.
4. Trong Authentication → Settings → Authorized domains, bảo đảm có `PROJECT_ID.web.app` và `PROJECT_ID.firebaseapp.com`. Nhập hostname, không nhập `https://` hoặc đường dẫn. Nếu OAuth project còn ở chế độ thử nghiệm có giới hạn test user, thêm người kiểm thử trong Google Auth Platform.
5. Tạo Firestore database `(default)`, **Standard edition/Native mode**, chọn location đã chốt. Chọn chế độ production để khởi đầu đóng quyền; sau đó deploy Rules của repo. Không dùng test mode mở toàn bộ database.
6. Kiểm tra Firebase Hosting site mặc định có ID trùng project; tạo site này trong Console nếu chưa có. Ví dụ manifest phía dưới dùng một site mặc định duy nhất.
7. Bật billing/Blaze khi đã đồng ý phạm vi chi phí. Tạo budget alerts cho project và kiểm tra email nhận cảnh báo.

Giữ `authDomain` lấy từ Firebase web config ở lần đầu. Nếu đổi authDomain sang custom domain, cần cấu hình cả authorized domain và OAuth redirect handler; xem [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin). Không sửa OAuth client secret để chép vào `VITE_*`.

**Kết quả cần thấy:** đúng project staging, Google Enabled, database đã tạo đúng location, có Hosting site và budget alerts. Chưa nhập dữ liệu gia phả thật.

## 6. Đăng nhập CLI, bật API và tạo runtime identity

Mở PowerShell ở gốc repo, thay project ID bằng giá trị thật. Các biến này chỉ tồn tại trong terminal hiện tại; mở terminal mới phải khai báo lại.

```powershell
$stagingProject = 'THAY_PROJECT_ID_STAGING'
$cloudRegion = 'asia-southeast1'
$apiService = 'coinguon-api'
$workerService = 'coinguon-reminders'
$registryName = 'coinguon'
$runtimeIdentity = 'coinguon-api@' + $stagingProject + '.iam.gserviceaccount.com'
$schedulerIdentity = 'coinguon-scheduler@' + $stagingProject + '.iam.gserviceaccount.com'
$siteOrigin = 'https://' + $stagingProject + '.web.app'

gcloud auth login
node node_modules/firebase-tools/lib/bin/firebase.js login
gcloud projects describe $stagingProject
node node_modules/firebase-tools/lib/bin/firebase.js projects:list
```

Đối chiếu project ID trên CLI với Firebase Console trước khi tiếp tục. Các lệnh bên dưới luôn truyền `--project`; không phụ thuộc project mặc định của CLI và không dùng `scripts/firebase.mjs` để deploy vì script đó luôn chọn project demo.

```powershell
gcloud services enable run.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com --project $stagingProject
gcloud iam service-accounts create coinguon-api --display-name 'Coi Nguon staging runtime' --project $stagingProject
gcloud iam service-accounts create coinguon-scheduler --display-name 'Coi Nguon staging scheduler' --project $stagingProject
gcloud projects add-iam-policy-binding $stagingProject --member "serviceAccount:$runtimeIdentity" --role roles/datastore.user
gcloud projects add-iam-policy-binding $stagingProject --member "serviceAccount:$runtimeIdentity" --role roles/firebaseauth.viewer
gcloud artifacts repositories create $registryName --repository-format docker --location $cloudRegion --project $stagingProject
```

Runtime cần đọc/ghi Firestore bằng backend và đọc trạng thái người dùng để xác minh phiên; quyền đọc Auth tham chiếu [Firebase Authentication Viewer](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth). Scheduler chỉ cần quyền invoke worker, được cấp ở mục 10. Không dùng account triển khai làm runtime; cơ chế credentials gắn service xem [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity).

Nếu tài nguyên đã tồn tại, kiểm tra lại bằng Console trước khi bỏ qua lỗi `ALREADY_EXISTS`; không chạy lệnh xóa/tạo lại project hoặc database. `PERMISSION_DENIED` cần xử lý đúng IAM/tài khoản, không giải quyết bằng mở Rules.

## 7. Tạo khóa HMAC trong Secret Manager

Trong Google Cloud Console → Secret Manager, chọn đúng staging project:

1. Tạo secret tên `coinguon-phone-hmac`.
2. Tạo khóa ngẫu nhiên **32 byte**, biểu diễn hex thành 64 ký tự, bằng công cụ sinh secret an toàn của bạn; nhập trực tiếp vào Secret value, không chép vào repo/chat hoặc lệnh shell.
3. Tạo version 1. Ghi lại **số version**, không ghi giá trị khóa vào tài liệu.
4. Cấp runtime quyền đọc đúng secret:

```powershell
gcloud secrets add-iam-policy-binding coinguon-phone-hmac --member "serviceAccount:$runtimeIdentity" --role roles/secretmanager.secretAccessor --project $stagingProject
```

Cloud Run sẽ nhận `PHONE_LOOKUP_HMAC_KEY` từ version cụ thể. Các revision/worker cùng môi trường dùng cùng khóa; staging và production dùng secret khác. Cách cấu hình và IAM xem [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

**Dừng nếu chưa có adapter đọc secret ở mục 3.3.** Cấp secret cho Cloud Run không tự thay logic khóa local trong source.

## 8. Đóng gói và deploy API

### 8.1. Dockerfile tham chiếu, phải tạo và kiểm tra trước

Tạo `Dockerfile` ở gốc repo khi hoàn thiện mục 3. Mẫu này phục vụ backend Node chạy TypeScript trực tiếp như local, giữ cả domain code dùng chung:

```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend ./backend
COPY src/shared/domain ./src/shared/domain
ENV NODE_ENV=production
USER node
CMD ["node", "--experimental-strip-types", "backend/server.ts"]
```

Tag Node ở đây là mẫu; trước release chọn bản vá/image digest đã kiểm tra. Nếu adapter thêm runtime import ngoài hai thư mục trên, phải cập nhật COPY. Tạo `.dockerignore` loại `.git`, `node_modules`, `dist`, `.env*`, `.tools`, `automation_test/artifacts`, debug log và mọi credential khỏi build context. Không COPY toàn bộ repo hoặc dùng frontend dev server làm API runtime.

### 8.2. Build và push image

Chọn mã release riêng, ví dụ ngày và số thứ tự. Không dùng tag `latest` cho bản cần rollback:

```powershell
$releaseTag = 'staging-20261030-01'
$registryHost = $cloudRegion + '-docker.pkg.dev'
$apiImage = $registryHost + '/' + $stagingProject + '/' + $registryName + '/api:' + $releaseTag
gcloud auth configure-docker $registryHost
docker build --platform linux/amd64 -t $apiImage .
docker push $apiImage
```

Chỉ tiếp tục khi build và push thành công. Luồng registry tham chiếu [Artifact Registry Docker quickstart](https://docs.cloud.google.com/artifact-registry/docs/docker/store-docker-container-images).

### 8.3. Deploy service API

Lệnh nền sau cần adapter và limiter cloud đã hoàn thiện, cùng các biến bổ sung được cập nhật tại mục 3.5. Dùng một origin lúc đầu để giảm nhầm cấu hình:

```powershell
gcloud run deploy $apiService --image $apiImage --region $cloudRegion --project $stagingProject --service-account $runtimeIdentity --port 8080 --cpu 1 --memory 512Mi --min-instances 0 --max-instances 2 --concurrency 20 --timeout 60 --set-env-vars "APP_ENV=staging,APP_ROLE=api,FIREBASE_PROJECT_ID=$stagingProject,ALLOWED_ORIGINS=$siteOrigin" --set-secrets 'PHONE_LOOKUP_HMAC_KEY=coinguon-phone-hmac:1' --allow-unauthenticated
```

API được mở cho request Internet để Hosting/khách thiệp gọi được; các API riêng vẫn phải kiểm Firebase ID token và quyền. Bảo vệ cả URL `run.app` gọi trực tiếp, không coi Origin là bằng chứng người dùng hợp lệ. Không gắn endpoint quét nhắc không xác thực vào service public này. Cờ deploy tham chiếu [gcloud run deploy](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy).

```powershell
$apiOrigin = gcloud run services describe $apiService --region $cloudRegion --project $stagingProject --format 'value(status.url)'
Invoke-RestMethod ($apiOrigin + '/api/health')
```

**Kết quả cần thấy:** mode staging và project ID đúng; không có Emulator connection. Nếu container chưa ready, xem Cloud Run → service → Logs. Không tiếp tục deploy frontend khi API không khởi động được.

## 9. Build frontend cloud và cấu hình Hosting

### 9.1. Cấu hình build

Sau khi frontend adapter ở mục 3 đọc các biến này, tạo `.env.staging.local` ở gốc repo, điền web config đã lấy ở mục 5:

```dotenv
VITE_APP_ENV=staging
VITE_FIREBASE_API_KEY=THAY_API_KEY_WEB
VITE_FIREBASE_AUTH_DOMAIN=THAY_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=THAY_PROJECT_ID
VITE_FIREBASE_APP_ID=THAY_WEB_APP_ID
VITE_API_BASE_URL=/api
```

Đây là cấu hình build công khai. Không thêm service-account JSON, HMAC hoặc OAuth client secret. Các tên biến trên **chưa có tác dụng với source local hiện tại**. `.env.staging.local` đã nằm trong mẫu ignore `.env.*`; kiểm tra lại trước khi commit. Nếu đang có biến `VITE_*` trong môi trường PowerShell, loại bỏ/đối chiếu để tránh ghi đè giá trị staging khi build.

Script build hiện tại là chuỗi nhiều lệnh. Dùng đúng ba lệnh dưới để mode đến Vite và service worker được sinh sau cùng:

```powershell
npm run typecheck
node node_modules/vite/bin/vite.js build --mode staging
node scripts/build-service-worker.mjs
```

Mở bản build để kiểm tra config/network: request Auth/Firestore đến project staging và API đến `/api/**`; không có request tới `localhost`, `127.0.0.1` hoặc project demo. Chuỗi localhost có thể còn trong SDK bundle, nên grep chuỗi không thay thế kiểm tra request thực tế. Đổi env sau khi build cần build lại.

### 9.2. Manifest Firebase cloud

Tạo `firebase.staging.json` ở gốc repo theo cấu hình sau, thay `asia-southeast1` nếu đã chọn region khác. Giữ `firebase.json` hiện có cho Emulator; không chạy `firebase init` ghi đè cấu hình local.

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.staging.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Cache-Control", "value": "no-store" },
          { "key": "Referrer-Policy", "value": "no-referrer" },
          { "key": "X-Content-Type-Options", "value": "nosniff" }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "coinguon-api",
          "region": "asia-southeast1",
          "pinTag": true
        }
      },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

`firestore.indexes.json` phải là manifest truy vấn đã kiểm chứng ở mục 3.4, không phải tên file giả để bỏ qua lỗi deploy. Nếu dùng site khác site mặc định hoặc đổi tên API, sửa cấu hình tương ứng trước khi chạy lệnh.

API rewrite đặt trước SPA fallback. `pinTag` gắn Hosting release với revision API; rollback Hosting có thể quay lại revision đã gắn. Kiểm tra tag cũ còn tồn tại trước rollback. Xem [Hosting + Cloud Run](https://firebase.google.com/docs/hosting/cloud-run).

Mẫu staging dùng `no-store` cho HTTP để ưu tiên kiểm tra cache riêng tư và cập nhật PWA; service worker vẫn quản lý app shell theo code. Khi tối ưu cache asset có hash phải kiểm tra riêng HTML, worker, API và trang token; xem [Hosting cache](https://firebase.google.com/docs/hosting/manage-cache).

### 9.3. Deploy Rules/index trước, Hosting sau

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules,firestore:indexes --config firebase.staging.json --project $stagingProject
```

Chờ index build xong trong Firestore Console → Indexes. Chạy các truy vấn thật bằng dữ liệu giả. Nếu lỗi thiếu index, đối chiếu truy vấn và index được yêu cầu rồi cập nhật manifest, deploy lại; không mở Rules để chữa lỗi index. Xem [Firestore indexing](https://firebase.google.com/docs/firestore/query-data/indexing).

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting --config firebase.staging.json --project $stagingProject
Invoke-RestMethod ($siteOrigin + '/api/health')
```

**Kết quả cần thấy:** URL HTTPS tải được; `/api/health` trả JSON đúng project; mở/reload `/dong-ho`, `/ngoai-tuyen`, `/tham-gia` và `/loi-moi` không bị Hosting 404. Link khách hợp lệ được thử bằng token giả tạo trong app, không chép token vào log.

## 10. Nhắc định kỳ và push

Chỉ thực hiện sau khi worker riêng ở mục 3.4 đã được hiện thực và test. Hiện source chưa có endpoint/role này.

1. Deploy cùng image vào service **private** với `APP_ROLE=worker`, không chạy vòng `setInterval` local.
2. Cấp scheduler identity quyền gọi đúng worker.
3. Tạo lịch mỗi phút, dùng OIDC vào URL worker trực tiếp, không đi qua Hosting.

```powershell
gcloud run deploy $workerService --image $apiImage --region $cloudRegion --project $stagingProject --service-account $runtimeIdentity --port 8080 --cpu 1 --memory 512Mi --min-instances 0 --max-instances 1 --concurrency 1 --timeout 300 --set-env-vars "APP_ENV=staging,APP_ROLE=worker,FIREBASE_PROJECT_ID=$stagingProject" --set-secrets 'PHONE_LOOKUP_HMAC_KEY=coinguon-phone-hmac:1' --no-allow-unauthenticated
gcloud run services add-iam-policy-binding $workerService --member "serviceAccount:$schedulerIdentity" --role roles/run.invoker --region $cloudRegion --project $stagingProject
$workerOrigin = gcloud run services describe $workerService --region $cloudRegion --project $stagingProject --format 'value(status.url)'
gcloud scheduler jobs create http coinguon-reminders --location $cloudRegion --schedule '* * * * *' --time-zone 'Etc/UTC' --uri "$workerOrigin/internal/reminders/tick" --http-method POST --oidc-service-account-email $schedulerIdentity --oidc-token-audience $workerOrigin --message-body '{}' --attempt-deadline 300s --project $stagingProject
gcloud scheduler jobs run coinguon-reminders --location $cloudRegion --project $stagingProject
```

Người tạo job cần quyền dùng scheduler service account; project phải giữ đúng Cloud Scheduler service agent được hệ thống cấp. Xem [Cloud Scheduler gọi Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-scheduler). Khi cập nhật job đã tồn tại, dùng thao tác Update, không tạo job trùng tên/lịch.

Kiểm tra worker trả 2xx cho scheduler và từ chối request không có IAM; gọi lặp không tạo inbox trùng. Thử công bố, đổi lịch, hủy và thu hồi membership với sự kiện giả. Không mở endpoint đổi clock công khai để thử mốc 7/3 ngày.

**FCM chưa được hướng dẫn bằng lệnh giả:** repo chưa có adapter/subscription/token lifecycle cloud. Khi hoàn thiện, bổ sung chính xác Web Push certificate/public VAPID key, service worker đang dùng, quyền IAM gửi, lưu/xóa token và cấu hình vào runbook này. Chưa kiểm chứng app đóng thì chưa tuyên bố có push nền hoặc phát hành pilot đầy đủ.

## 11. Kiểm tra sau deploy — làm trước khi cho gia đình dùng

Dùng hai Google account kiểm thử và hai gia phả giả, trên URL staging HTTPS. Tài khoản đăng nhập Google thật nhưng hồ sơ/người/số thử phải là dữ liệu kiểm thử được kiểm soát, không mời số của người khác.

1. **Kết nối:** `/api/health` đúng project, mọi request không còn về localhost/demo; gọi API riêng không có token bị từ chối, token từ project khác bị từ chối. Worker private không gọi được như API khách.
2. **Google:** popup thật đăng nhập được; account mới phải hoàn tất tên/số trước khi tạo dòng họ; Google không tự cấp membership. Thử đóng popup và đăng nhập lại. Đổi số phải reauthenticate; trùng số 0/+84 bị từ chối.
3. **Mời/duyệt:** admin tạo hồ sơ sống và mời; người nhận chỉ thấy inbox tối thiểu; trước duyệt không xem được gia phả. Duyệt đúng người mới tạo membership/personLink; thu hồi, từ chối, duyệt lặp và đổi số không chuyển quyền sai người.
4. **Phân quyền:** account gia phả A không xem/sửa B kể cả gọi API đổi ID hoặc đọc Firestore trực tiếp. Member không tự nâng quyền; admin cuối không tự rời. Thử đổi vai trò và thu hồi khi tab thành viên đang mở.
5. **Gia phả/lịch:** tạo hồ sơ ngày thiếu, quan hệ, hai tab sửa cùng phiên bản; mốc lịch âm được đối chiếu, sự kiện chỉ công bố sau xác nhận. Chuyển chủ sự cần người nhận đồng ý.
6. **Thiệp:** mở link hộ ở cửa sổ không đăng nhập, sửa 4 thành 3 người không cộng trùng; link xem không ghi RSVP; link thu hồi/lịch cũ/quá hạn bị từ chối. Người khách không đọc được dữ liệu gia phả.
7. **PWA:** vào online trước, chủ động tải trên thiết bị riêng → mất mạng → reload → chỉ đọc dữ liệu đã tải. Ghi bị chặn, không xếp hàng. Logout offline xóa bản tải; đổi account không xem bản cũ. Nối mạng sau thu hồi quyền phải xóa bản đã mất quyền. Kiểm tra cả cập nhật worker khi đang nhập form, không tự làm mất bản nháp.
8. **Nhắc:** scheduler chạy thực sự kể cả không có người mở app; retry và gọi trùng không tạo nhắc trùng; hủy/đổi lịch/mất quyền vô hiệu nhắc cũ. Thử thông báo bị từ chối và FCM/app đóng nếu đã tích hợp.
9. **Thiết bị:** Android/Chrome và iPhone/Safari/PWA thật, popup/cài đặt/quyền/mạng yếu; 320px, chữ 200%, bàn phím. Mobile giả lập trên Edge không thay thế bước này. Trình duyệt trong Zalo cần kiểm chứng riêng hoặc hướng dẫn mở bằng browser hỗ trợ.
10. **Khôi phục:** xuất JSON gia phả giả và khôi phục vào gia phả thử riêng; đối chiếu ngày/quan hệ/quyền. Sao lưu hạ tầng cloud và diễn tập sang môi trường riêng phải có trước dữ liệu thật: Firestore, Auth và Storage nếu sử dụng, cùng cách bảo vệ/khôi phục khóa HMAC. JSON trong app không chứa đủ các phần này.

Nếu một mục bắt buộc thất bại, giữ staging và sửa trước; không dùng dữ liệu thật để chứng minh chức năng. Tham chiếu phạm vi nghiệm thu tại [TESTING.md](TESTING.md) và [PRD](PRD_CoiNguon_App.md).

## 12. Phát hành production và custom domain

Chỉ phát hành sau khi staging đạt, ngân sách/region/chính sách dữ liệu được chủ dự án chốt và có phạm vi cho phép deploy production. Hướng dẫn này không phải sự cho phép tự bật billing hoặc phát hành thay chủ dự án.

1. Tạo **project production riêng**, lặp lại Auth/Firestore/IAM/secret/registry/Hosting. Không copy dữ liệu Emulator hoặc người dùng thử sang production.
2. Tạo `.env.production.local`, manifest `firebase.production.json` và biến terminal riêng trỏ đúng project production; cấu hình `APP_ENV=production`. Không dùng lại lệnh staging chỉ với một phần biến đã thay.
3. Xây image/frontend từ cùng một phiên bản code đã kiểm tra; kiểm tra image digest, frontend project ID, Rules/index và secret version trước deploy. Dùng đúng namespace account runtime/scheduler của production.
4. Trong Hosting → Add custom domain, làm theo DNS records và chờ chứng chỉ HTTPS ready; giữ nguyên DNS email khác. Thêm hostname vào Firebase Auth authorized domains và `ALLOWED_ORIGINS`; nếu đổi authDomain, làm thêm cấu hình OAuth theo mục 5 rồi build lại frontend.
5. Deploy Rules/index tương thích → API → Hosting → worker/scheduler; smoke ngay sau mỗi phần. Trong lần đầu, chỉ công bố URL cho nhóm pilot sau khi các ca bắt buộc đạt.
6. Trước mỗi release lưu commit, image digest, Hosting release, Rules/index version, secret version và người chịu trách nhiệm trong công cụ release đang dùng. Không ghi token hoặc dữ liệu gia phả vào ghi chú release.

## 13. Cập nhật, rollback và vận hành

**Cập nhật:** kiểm tra local → staging → nghiệm thu → production. Đừng chạy `firebase deploy` không giới hạn; luôn truyền `--project`, `--config` và `--only` cho đúng thành phần. CI hiện chưa deploy; không thêm credential vào workflow để bỏ qua bước chuẩn bị/kiểm tra.

**Rollback web/API:** Firebase Console → Hosting → release tốt trước đó → Roll back. Với `pinTag`, kiểm tra cả `/api/health` và revision API đã gắn. Đóng/mở lại PWA và thử cập nhật worker; client đang offline chưa nhận được bản rollback. Xem [quản lý Hosting releases](https://firebase.google.com/docs/hosting/manage-hosting-resources).

**Rollback worker:** cập nhật Cloud Run service về image digest tốt trước đó với đúng env/secret/IAM. Worker tách riêng không được rollback theo Hosting. Khi chưa xác định lỗi, tạm dừng scheduler trong Console để tránh tiếp tục tác vụ sai; phục hồi rồi thử lại chống trùng trước khi Resume.

**Dữ liệu/Rules:** rollback code không khôi phục dữ liệu và không tự rollback Rules/index/secret. Mỗi release phải tương thích dữ liệu cũ hoặc có kế hoạch di trú và khôi phục đã thử. Không xóa database, đổi HMAC hoặc nới Rules để chữa một lỗi ứng dụng.

**Theo dõi:** Cloud Run Logs/Error Reporting, scheduler execution, Firestore usage/index và billing alerts. Log chỉ metadata cần thiết: request ID, route, mã lỗi, thời lượng; không log Authorization, số điện thoại, nội dung hồ sơ hoặc fragment token. Đặt hạn lưu log và người được đọc theo chính sách đã chốt. Xem mức tăng 401/403/429/5xx và delivery retry trước khi tăng quota.

## 14. Xử lý lỗi thường gặp

- **Trang mở được nhưng không đăng nhập/lưu được:** DevTools → Network thấy `127.0.0.1` hoặc demo project. Chưa hoàn thiện adapter, dùng sai mode build hoặc PWA cũ; kiểm tra mục 3/9 và cập nhật app.
- **Cloud Run không start/không nghe cổng:** còn bind localhost/8787, thiếu biến hoặc thiếu runtime dependency/domain file. Kiểm tra `PORT`, `0.0.0.0` và Logs, không tăng timeout để che lỗi cấu hình.
- **`auth/unauthorized-domain`, popup bị chặn:** kiểm tra authorized domains và authDomain của đúng project; popup phải mở từ thao tác người dùng. Thử browser hệ thống và đối chiếu OAuth handler, không bật Email/Password để lách Google.
- **403 sau khi Hosting rewrite:** phân biệt IAM Cloud Run, Host/Origin và quyền ứng dụng. API public có Firebase authorization; worker private dùng IAM. Không mở worker public hoặc xóa kiểm tra membership.
- **`PERMISSION_DENIED` khi dùng Firestore:** xác định lỗi từ client Rules hay Admin SDK IAM. Kiểm tra account complete/membership, project ID và runtime identity; không chuyển sang allow-all.
- **`FAILED_PRECONDITION`/cần index:** tạo đúng index, lưu lại manifest và chờ build xong.
- **API trả HTML thay JSON:** rewrite `/api/**` sai thứ tự/tên service/region hoặc API trả 404 rồi bị xử lý sai; kiểm tra Network Content-Type và `/api/health` qua cả Hosting lẫn URL Cloud Run.
- **Secret access denied hoặc số cũ không được nhận diện:** kiểm tra version và runtime IAM; không sinh khóa mới để thử. Khôi phục đúng khóa cũ và kiểm tra quy trình di trú nếu đã đổi.
- **Nhắc không chạy khi app đóng:** kiểm tra scheduler/worker cloud, không dựa vào `setInterval` local; inbox không đồng nghĩa đã có FCM.
- **Upload ảnh bị từ chối:** hiện Storage Rules đóng toàn bộ, chưa có luồng cloud upload. Hoàn thiện kiểm tra quyền/loại/kích thước trước khi triển khai, không mở bucket công khai.

## 15. Phạm vi kiểm chứng của tài liệu

Đã đối chiếu manifest, API client/server, Auth, Rules, worker và CI hiện có; các liên kết Firebase/Google Cloud ở trên là nguồn chính thức. Các ví dụ cloud là cấu hình tham chiếu để hoàn thiện adapter và deploy sau đó, **chưa được chạy trên tài khoản cloud**. Không có project, billing, secret, tài nguyên hay dữ liệu production nào được tạo/thay đổi khi viết tài liệu này.

Sau khi adapter và lần deploy staging đầu tiên hoàn tất, cập nhật giao ước/lệnh theo cấu hình thật và kết quả kiểm chứng; không đánh dấu cloud sẵn sàng chỉ vì đã có tài liệu.

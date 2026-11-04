# Hướng dẫn đưa Cội Nguồn lên Internet từ đầu

Dành cho người triển khai: mở trang nào, bấm gì, điền gì và kiểm tra kết quả nào. Bạn không cần viết mã ứng dụng hoặc tự soạn Dockerfile. Các đoạn lệnh dưới đây dùng để cài công cụ, kết nối tài khoản và phát hành.

**Trạng thái ngày 04/11/2026:** code đã có adapter Firebase thật cho frontend/backend, cấu hình đóng gói và worker nhắc. `npm run build:cloud` tạo bản web từ `.env.local` trên máy. Chưa phát hành cloud hoặc nghiệm thu OAuth/IAM thật. Phần B là bước thiết lập quyền dịch vụ, secret và phát hành; bạn không cần tự viết source hoặc Dockerfile.

## Trước khi bắt đầu

- Dùng cùng một Google account quản lý Firebase và Google Cloud.
- Làm thử với gia phả giả trước khi đưa dữ liệu gia đình thật lên.
- Ghi lại email quản lý, Project ID, vùng lưu dữ liệu và URL website.
- Không chia sẻ mật khẩu, mã xác minh hoặc khóa bí mật.
- Tên nút được ghi bằng tiếng Anh để dễ đối chiếu; giao diện có thể hiển thị tiếng Việt hoặc thay đổi vị trí menu.

# Phần A — Tạo tài khoản và thiết lập dịch vụ

## 1. Tạo tài khoản để dùng Firebase

Firebase dùng tài khoản Google. Nếu đã có Gmail/tài khoản Google, bạn có thể dùng ngay và bỏ qua bước đăng ký.

Nếu chưa có:

1. Mở [trang đăng ký Google](https://accounts.google.com/signup).
2. Chọn tạo tài khoản cho bản thân nếu đây là dự án cá nhân.
3. Nhập tên và các thông tin được yêu cầu.
4. Chọn địa chỉ Gmail mới, hoặc chọn dùng email hiện có nếu muốn.
5. Tạo mật khẩu, hoàn thành xác minh theo hướng dẫn trên màn hình.
6. Mở [Firebase Console](https://console.firebase.google.com/), đăng nhập bằng tài khoản vừa tạo.
7. Đọc và chấp nhận điều khoản nếu được hỏi.

Bạn không cần tạo mật khẩu Firebase riêng. [Hướng dẫn Google](https://support.google.com/accounts/answer/27441).

**Xong khi:** mở được Firebase Console và thấy danh sách dự án hoặc nút tạo dự án.

## 2. Tạo dự án Firebase cho Cội Nguồn

1. Trong Firebase Console, bấm **Create a project / Add project**.
2. Đặt tên hiển thị: **Cội Nguồn thử nghiệm**.
3. Kiểm tra **Project ID** được đề xuất. Ví dụ `coinguon-thu-2026-abc`; nếu trùng, thay phần cuối.
4. Ghi lại chính xác Project ID. Các lệnh sau dùng ID này, không dùng tên tiếng Việt. Không dùng ID bắt đầu bằng `demo-`.
5. Nếu có tùy chọn Analytics/tính năng bổ sung, có thể bỏ qua ở lần đầu.
6. Bấm **Create project**, chờ hoàn tất rồi **Continue**.
7. Vào bánh răng cạnh Project Overview → **Project settings → General**, đối chiếu lại Project ID.

**Xong khi:** có project riêng và đã lưu Project ID.

Firebase project đồng thời là Google Cloud project. Không tạo thêm một Google Cloud project khác để ghép vào. [Giải thích chính thức](https://firebase.google.com/docs/projects/learn-more).

## 3. Mở Google Cloud của đúng project

1. Mở [Google Cloud Console](https://console.cloud.google.com/).
2. Đăng nhập bằng cùng Google account ở bước 1.
3. Chấp nhận điều khoản nếu được hỏi.
4. Bấm bộ chọn project trên thanh đầu trang.
5. Tìm bằng Project ID vừa tạo và chọn.
6. Nếu không thấy, kiểm tra email ở avatar góc phải, sau đó tải lại danh sách.

Firebase quản lý đăng nhập/dữ liệu/website; Google Cloud quản lý thêm máy chủ và lịch chạy nhắc. Chúng đang dùng cùng một project. [Nguồn](https://firebase.google.com/docs/projects/learn-more).

**Xong khi:** Project ID trong Google Cloud trùng Firebase.

## 4. Bật Google login cho người dùng Cội Nguồn

Google account ở bước 1 dùng để quản lý dịch vụ. Bước này cho phép người dùng ứng dụng đăng nhập bằng Google.

1. Firebase Console → chọn project → **Authentication**.
2. Bấm **Get started** nếu lần đầu.
3. Mở **Sign-in method / Sign-in providers**.
4. Chọn **Google**, bật **Enable**.
5. Chọn **Support email**, lần đầu có thể dùng email quản lý của bạn.
6. Bấm **Save**.
7. Vào **Settings → Authorized domains**.
8. Kiểm tra có `PROJECT_ID.firebaseapp.com` và `PROJECT_ID.web.app`. Thay `PROJECT_ID` bằng ID thật.
9. Thiếu domain nào, bấm **Add domain**, nhập hostname đó rồi lưu. Không nhập `https://` hay đường dẫn.

Không cần bật Phone/SMS hoặc Email/Password để dùng phương án đăng nhập hiện tại. Số điện thoại trong Cội Nguồn vẫn là số tự khai.

**Xong khi:** provider Google hiển thị Enabled và domain website có trong danh sách. Đăng nhập thực tế chỉ kiểm tra được sau khi có bản cloud. [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

## 5. Tạo database lưu gia phả

1. Firebase Console → **Firestore Database**.
2. Bấm **Create database / Add database**.
3. Nếu hỏi edition, chọn **Standard edition**.
4. Database ID giữ `(default)`.
5. Chọn nơi lưu dữ liệu. Phương án tham chiếu cho bản thử là **Singapore — asia-southeast1**; chỉ chọn sau khi bạn đồng ý vùng này.
6. Chọn **Production mode** cho quyền ban đầu.
7. Bấm **Create**, chờ database tạo xong.
8. Để database trống. Không cần tự tạo collection hoặc nhập hồ sơ bằng Console.

Production mode ở đây là chế độ quyền ban đầu đóng truy cập, không có nghĩa đã phát hành bản production. Quyền của ứng dụng sẽ được nạp khi deploy.

**Xong khi:** thấy tab Data/Rules/Indexes của database `(default)`. Chọn location cẩn thận vì database đã tạo không thể đơn giản đổi vùng. [Tạo Firestore](https://firebase.google.com/docs/firestore/manage-databases).

## 6. Đăng ký ứng dụng web và lấy thông tin kết nối

1. Firebase Console → bánh răng → **Project settings → General**.
2. Ở **Your apps**, bấm biểu tượng web **</>**; nếu đã có app, chọn **Add app → Web**.
3. Nickname: **Cội Nguồn Web thử nghiệm**.
4. Bấm **Register app**.
5. Màn hình có thể hiện hướng dẫn SDK kèm mã JavaScript. Bạn chưa cần chép mã đó vào source.
6. Lưu bốn giá trị **apiKey**, **authDomain**, **projectId**, **appId** để điền khi phát hành.
7. Bấm **Continue to console**.
8. Xem lại thông tin tại Your apps → chọn Web app → **SDK setup and configuration → Config**.

Các giá trị này là cấu hình web công khai. Không tải service-account private key hoặc OAuth client secret để thay vào.

**Xong khi:** thấy Web app trong Your apps và lưu đủ bốn giá trị. Đăng ký Web app chưa tải source máy bạn lên Firebase. [Đăng ký Web app](https://firebase.google.com/docs/web/setup).

## 7. Cài công cụ trên Windows

### Node.js

1. Mở [trang tải Node.js](https://nodejs.org/en/download).
2. Chọn Windows Installer đúng loại máy, thường là x64.
3. Repo hỗ trợ Node 22 từ 22.12 trở lên hoặc nhánh 24 trở lên; tránh nhánh 23.
4. Chạy bộ cài, giữ thành phần npm và tùy chọn thêm vào PATH.
5. Cài xong đóng terminal cũ và mở terminal mới.

### Google Cloud CLI

1. Mở [trang cài Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install).
2. Tải và chạy bộ cài cho Windows.
3. Giữ Python đi kèm nếu được đề xuất và máy chưa có bản phù hợp.
4. Nếu bộ cài chạy `gcloud init`, đăng nhập đúng Google account và chọn Project ID.
5. Mở lại terminal sau cài. [Thông tin bộ cài](https://docs.cloud.google.com/sdk/docs/downloads-interactive).

### Chuẩn bị thư mục ứng dụng

Trong IDE đang mở Cội Nguồn, chọn **Terminal → New Terminal**, dùng PowerShell. Chạy lần lượt:

```powershell
Set-Location -LiteralPath 'D:\WORK_SPACE\HOME_PROJECTS\CoiNguon'
node --version
npm --version
gcloud version
npm ci
node node_modules/firebase-tools/lib/bin/firebase.js --version
```

`npm ci` tải thư viện đã chọn cho dự án, gồm Firebase CLI; chờ thành công trước khi chạy dòng cuối. Nếu bị chặn `npm.ps1`, dùng `npm.cmd ci` thay thế, không cần đổi chính sách toàn máy.

**Xong khi:** hiện được các phiên bản và cài thư viện thành công.

## 8. Liên kết source trên máy với Firebase

Giữ PowerShell ở thư mục Cội Nguồn:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js login
```

1. Trình duyệt mở ra: chọn đúng Google account quản lý Firebase, đọc yêu cầu và cho phép đăng nhập.
2. Quay lại terminal, chạy:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js projects:list
node node_modules/firebase-tools/lib/bin/firebase.js use --add
```

3. Chọn Project ID đúng trong danh sách.
4. Khi hỏi alias, nhập `staging` rồi Enter. Đây là tên gọi tắt cho môi trường thử trên máy.
5. Kiểm tra và đăng nhập Google Cloud:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js use
gcloud auth login
```

6. Chọn cùng Google account.
7. Khai báo thông tin cho các lệnh tiếp theo; thay dòng đầu bằng ID thật:

```powershell
$projectId = 'THAY_PROJECT_ID_CUA_BAN'
$region = 'asia-southeast1'
$siteUrl = 'https://' + $projectId + '.web.app'
$runtimeAccount = 'coinguon-api@' + $projectId + '.iam.gserviceaccount.com'
$buildAccount = 'coinguon-build@' + $projectId + '.iam.gserviceaccount.com'
$schedulerAccount = 'coinguon-scheduler@' + $projectId + '.iam.gserviceaccount.com'
gcloud projects describe $projectId
```

Các biến chỉ có trong terminal đang mở. Mở terminal mới cần khai báo lại.

**Xong khi:** alias staging trỏ đúng project và gcloud đọc được project đó. Đăng nhập CLI mới kết nối công cụ deploy; cấu hình lấy ở bước 6 mới kết nối ứng dụng với Firebase. Không chạy `firebase init` ghi đè cấu hình repo. [Firebase CLI](https://firebase.google.com/docs/cli).

Không bắt buộc có GitHub: cách dưới tải bản ứng dụng từ thư mục hiện tại khi phát hành. Tự deploy khi push GitHub là thiết lập riêng, repo chưa có.

# Phần B — Phát hành ứng dụng

Repo đã có cấu hình phát hành web/API và worker. Trước phần B, cần xác nhận project thử, region, phạm vi chi phí và quyền tài khoản quản lý. API dùng service identity của Cloud Run, secret được gắn từ Secret Manager; bốn giá trị cấu hình web không thay thế các quyền này. Các bước cloud vẫn cần được kiểm chứng trên project thử.

Chưa nên bật billing chỉ để chờ bản ứng dụng.

## 9. Tạo tài khoản thanh toán và nâng gói

Phương án này dùng Firebase Hosting cho website và Cloud Run cho máy chủ. Cloud Run cần liên kết billing; Firebase dùng gói **Blaze**.

1. Firebase Console → đúng project → **Upgrade** cạnh tên gói.
2. Chọn **Blaze / Pay as you go**.
3. Nếu có billing account, chọn tài khoản bạn quản lý.
4. Nếu chưa có, chọn tạo tài khoản thanh toán mới.
5. Nhập quốc gia, loại hồ sơ cá nhân/doanh nghiệp, tên và địa chỉ đúng.
6. Thêm phương thức thanh toán Google hỗ trợ tại quốc gia đó, hoàn thành xác minh nếu có.
7. Đọc điều kiện rồi xác nhận liên kết với project Cội Nguồn.
8. Kiểm tra Firebase hiển thị gói Blaze.

Không giả định được miễn phí hoàn toàn hoặc luôn có free credit. [Gói Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [tạo billing account](https://docs.cloud.google.com/billing/docs/how-to/create-billing-account).

Tạo cảnh báo chi phí:

1. Google Cloud Console → **Billing** → chọn billing account.
2. Vào **Budgets & alerts → Create budget**.
3. Đặt tên **Cội Nguồn thử nghiệm**, giới hạn phạm vi vào đúng project.
4. Điền ngân sách tháng bạn chấp nhận, kiểm tra đơn vị tiền tệ.
5. Thêm ngưỡng cảnh báo, ví dụ 50%, 90%, 100%; kiểm tra email nhận.
6. Lưu.

**Xong khi:** project có billing và cảnh báo. Cảnh báo ngân sách không tự giới hạn tiền phải trả. [Budget alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## 10. Thiết lập những dịch vụ còn lại

Các thành phần dưới dùng chung Google account/project, không cần đăng ký tài khoản riêng.

### Bật API dịch vụ

Google Cloud Console → **APIs & Services → Library**, tìm từng tên và bấm **Enable**:

- Cloud Run Admin API: chạy máy chủ.
- Cloud Build API: đóng gói ứng dụng trên Google.
- Artifact Registry API: lưu bản đóng gói.
- Secret Manager API: giữ khóa bí mật.
- Cloud Scheduler API: chạy lịch nhắc.
- Kiểm tra Cloud Firestore API và Identity Toolkit API đã bật sau thiết lập Firebase.

**Xong khi:** chúng có trong **Enabled APIs & services**.

### Tạo tài khoản dành cho dịch vụ

Service account là danh tính dành cho máy chủ, không phải Gmail mới.

1. Google Cloud Console → **IAM & Admin → Service Accounts → Create service account**.
2. Tạo ID `coinguon-api`, chọn **Create and continue**.
3. Cấp vai trò **Cloud Datastore User** và **Firebase Authentication Viewer**, rồi **Done**.
4. Tạo ID `coinguon-build`, cấp **Cloud Run Builder**.
5. Tạo ID `coinguon-scheduler`, chưa cấp quyền project.
6. Kiểm tra cả ba email thuộc đúng Project ID.
7. Không tạo/tải private key JSON; dịch vụ sẽ được gắn trực tiếp với danh tính này.

Nếu không có quyền, kiểm tra tài khoản quản lý; với project công ty, cần quản trị viên cấp quyền tạo tài nguyên và dùng các service account. Không cấp Owner cho các service account.

**Xong khi:** có đủ ba danh tính với vai trò trên. [Tạo service account](https://docs.cloud.google.com/iam/docs/service-accounts-create), [quyền build](https://docs.cloud.google.com/run/docs/configuring/services/build-service-account).

### Tạo khóa bí mật

Khóa này phục vụ đối chiếu số điện thoại, cần giữ ổn định qua các lần cập nhật.

1. Trong Google Cloud Console đúng project, bấm **Activate Cloud Shell** (biểu tượng terminal ở thanh trên).
2. Khởi tạo/Authorize nếu được hỏi.
3. Chạy lệnh sau **trong Cloud Shell**, thay Project ID thật. Đây là terminal trên trình duyệt, không phải PowerShell:

```bash
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create coinguon-phone-hmac --data-file=- --project=THAY_PROJECT_ID_CUA_BAN
```

Lệnh tạo khóa ngẫu nhiên và gửi thẳng vào Secret Manager, không yêu cầu bạn chép giá trị khóa vào source.

4. Tìm **Secret Manager** trên thanh tìm kiếm Console.
5. Mở `coinguon-phone-hmac`, kiểm tra Version 1 Enabled.
6. **Permissions → Grant access**.
7. Principal: email `coinguon-api@PROJECT_ID.iam.gserviceaccount.com`.
8. Role: **Secret Manager Secret Accessor**, rồi Save.

Nếu báo secret đã tồn tại, kiểm tra bản hiện có; không sinh khóa mới để chữa lỗi.

**Xong khi:** có secret version 1 và máy chủ được quyền đọc. [Secret Manager](https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets), [cấp quyền đọc từ Cloud Run](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

## 11. Gửi máy chủ lên Cloud Run

Quay về PowerShell của thư mục Cội Nguồn. Bản cloud phải kèm cấu hình đóng gói và loại trừ file riêng tư; bạn không phải tự soạn chúng. Cách này dùng Cloud Build, không cần cài Docker Desktop.

Sau khi bản cloud được xác nhận sẵn sàng, chạy:

```powershell
gcloud run deploy coinguon-api --source . --project $projectId --region $region --build-service-account "projects/$projectId/serviceAccounts/$buildAccount" --service-account $runtimeAccount --port 8080 --cpu 1 --memory 512Mi --min-instances 0 --max-instances 2 --concurrency 20 --timeout 60 --set-env-vars "APP_ENV=staging,APP_ROLE=api,FIREBASE_PROJECT_ID=$projectId,ALLOWED_ORIGINS=$siteUrl" --set-secrets 'PHONE_LOOKUP_HMAC_KEY=coinguon-phone-hmac:1' --allow-unauthenticated
```

1. Nếu hỏi bật API/tạo kho build, đối chiếu đúng project rồi xác nhận.
2. Chờ build/deploy hoàn tất.
3. Ghi **Service URL** kết thúc bằng `run.app`.
4. Console → **Cloud Run → coinguon-api**, kiểm tra Ready và region đúng.
5. Mở URL kèm `/api/health`, kiểm tra project ID và môi trường staging.

Cloud Run nhận source từ thư mục hiện tại; bạn không tải từng file thủ công. API cho phép request Internet để phục vụ website/khách thiệp, nhưng các chức năng riêng vẫn phải kiểm tra đăng nhập và quyền.

**Xong khi:** dịch vụ Ready và kiểm tra sức khỏe đúng project. Nếu lỗi, vào Logs và dừng phát hành web để xử lý. [Deploy từ source](https://docs.cloud.google.com/run/docs/deploying-source-code).

## 12. Chuẩn bị Hosting và phát hành website

### Tạo địa chỉ website

1. Firebase Console → **Hosting → Get started** nếu lần đầu.
2. Repo bàn giao đã có cấu hình Hosting, không làm lại lệnh khởi tạo trong trình hướng dẫn.
3. Tìm site mặc định, URL `https://PROJECT_ID.web.app`.
4. Nếu chưa có site, chạy một lần trong PowerShell:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js hosting:sites:create $projectId --project $projectId
```

Nếu báo tồn tại, xem site hiện có, không xóa/tạo lại.

**Xong khi:** có site và biết URL. [Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart).

### Điền cấu hình kết nối

Lấy thông tin ở bước 6, điền trong PowerShell:

```powershell
$env:VITE_APP_ENV = 'staging'
$env:VITE_FIREBASE_API_KEY = 'DIEN_apiKey'
$env:VITE_FIREBASE_AUTH_DOMAIN = 'DIEN_authDomain'
$env:VITE_FIREBASE_PROJECT_ID = $projectId
$env:VITE_FIREBASE_APP_ID = 'DIEN_appId'
$env:VITE_API_BASE_URL = '/api'
```

Giữ dấu nháy, chỉ thay phần chữ bên trong. Có thể bỏ thao tác nhập lại nếu `.env.local` đã có các giá trị tương ứng. Backend cloud đọc project từ `FIREBASE_PROJECT_ID` và dùng service account/secret ở bước 10–11.

### Đóng gói và tải lên

Chạy lần lượt, lỗi thì dừng:

```powershell
npm run build:cloud
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules,firestore:indexes --config firebase.staging.json --project $projectId
```

Vào Firestore → **Indexes**, đợi index đang tạo hoàn tất. Sau đó:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting --config firebase.staging.json --project $projectId
```

`firebase.staging.json` và index phải đi kèm bản cloud. Nếu thiếu, bên phát triển cần bổ sung; bạn không phải tự viết file đó.

**Xong khi:** công cụ báo Hosting URL, website mở được qua HTTPS; tải lại `/dong-ho` và đăng nhập Google thật thành công. [Kết nối Hosting và Cloud Run](https://firebase.google.com/docs/hosting/cloud-run), [index Firestore](https://firebase.google.com/docs/firestore/query-data/indexing).

## 13. Cài lịch nhắc giỗ

Repo đã có worker nhắc riêng; phần này phát hành worker có IAM bảo vệ và tạo lịch gọi. Không mở endpoint worker trên API public.

### Tạo dịch vụ nhắc

Trong PowerShell:

```powershell
gcloud run deploy coinguon-reminders --source . --project $projectId --region $region --build-service-account "projects/$projectId/serviceAccounts/$buildAccount" --service-account $runtimeAccount --port 8080 --cpu 1 --memory 512Mi --min-instances 0 --max-instances 1 --concurrency 1 --timeout 300 --set-env-vars "APP_ENV=staging,APP_ROLE=worker,FIREBASE_PROJECT_ID=$projectId" --set-secrets 'PHONE_LOOKUP_HMAC_KEY=coinguon-phone-hmac:1' --no-allow-unauthenticated
gcloud run services add-iam-policy-binding coinguon-reminders --member "serviceAccount:$schedulerAccount" --role roles/run.invoker --project $projectId --region $region
```

Ghi Service URL của `coinguon-reminders`. Dịch vụ này phải yêu cầu xác thực; mở bằng trình duyệt bị từ chối không phải lý do đổi sang public.

### Tạo lịch trên Console

1. Google Cloud Console → **Cloud Scheduler → Create job**.
2. Name: `coinguon-reminders`.
3. Region: vùng đã chọn.
4. Frequency: `* * * * *`, kiểm tra mỗi phút.
5. Timezone: **UTC**; ứng dụng vẫn xử lý ngày lễ theo múi giờ sự kiện.
6. Target type: **HTTP**.
7. URL: Service URL của dịch vụ nhắc, thêm `/internal/reminders/tick`.
8. Method: **POST**; body: `{}`; header Content-Type: `application/json`.
9. Authentication: **Add OIDC token**.
10. Service account: `coinguon-scheduler@PROJECT_ID.iam.gserviceaccount.com`.
11. Audience: Service URL của dịch vụ nhắc, không thêm đường dẫn.
12. Lưu, chọn **Force run / Run now**.
13. Kiểm tra thành công và Logs của worker.

**Xong khi:** lịch gọi được worker, retry không tạo nhắc trùng. [Scheduler gọi Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-scheduler).

Thông báo khi app đóng cần FCM được tích hợp và kiểm thử riêng. Tạo scheduler không tự bật push; bản hiện tại chưa có FCM nền. Upload ảnh cũng chưa được triển khai cloud, nên lần đầu chưa cần tạo Storage bucket.

## 14. Kiểm tra website dùng được thật chưa

Dùng tài khoản kiểm thử và hồ sơ gia phả giả:

1. Mở URL trên cửa sổ ẩn danh, đăng nhập Google và hoàn tất tài khoản.
2. Tạo gia phả, thêm hồ sơ, tải lại trang; dữ liệu vẫn còn.
3. Tài khoản thứ hai xin tham gia: trước duyệt chưa được xem gia phả.
4. Admin duyệt rồi thu hồi quyền; tài khoản thứ hai nhận/mất đúng quyền.
5. Tạo sự kiện, mở thiệp không đăng nhập và sửa số người tham dự.
6. Tải chủ động bản offline, ngắt mạng, reload: đọc được bản đã tải, không ghi được.
7. Logout offline xóa bản tải riêng; tài khoản khác không đọc được bản cũ.
8. Thử Android/Chrome và iPhone/Safari thật, chữ lớn, cài ra màn hình chính.
9. Xuất/khôi phục vào gia phả thử riêng.
10. Kiểm tra lịch nhắc, Logs và chi phí.

**Xong khi:** các luồng hoạt động mà máy phát triển không cần mở dev server. Mở được trang chủ chưa đủ để kết luận deploy thành công. Nếu vẫn hiện “giả lập” hoặc yêu cầu Emulator thì đang dùng sai bản.

Trước dữ liệu thật, cần có sao lưu/khôi phục cloud và chính sách dữ liệu; JSON xuất trong app không phải bản sao toàn bộ tài khoản/hạ tầng. Phạm vi nghiệm thu: [TESTING.md](TESTING.md).

## 15. Gắn tên miền riêng

Có thể dùng URL `web.app` cho lần thử đầu, chưa cần mua domain.

Khi có domain:

1. Firebase Console → **Hosting → Add custom domain**.
2. Nhập tên miền/subdomain bạn sở hữu.
3. Mở trang quản lý DNS ở nơi mua/quản lý domain.
4. Thêm đúng bản ghi Type/Host/Value Firebase yêu cầu; giữ bản ghi email khác.
5. Quay lại Firebase xác minh, chờ HTTPS sẵn sàng.
6. Authentication → Authorized domains → thêm hostname mới.
7. Bên cấu hình bản cloud cần cập nhật origin được máy chủ chấp nhận; nếu đổi domain đăng nhập, cập nhật Google tương ứng.
8. Thử đăng nhập và lưu dữ liệu từ domain mới.

**Xong khi:** HTTPS và đầy đủ chức năng hoạt động. [Custom domain](https://firebase.google.com/docs/hosting/custom-domain).

# Phần C — Cập nhật và xử lý lỗi

## 16. Cập nhật phiên bản

1. Nhận bản cloud đã được kiểm tra và thông tin thay đổi cấu hình.
2. Mở đúng thư mục, đăng nhập đúng account, khai báo lại các biến.
3. Cập nhật API theo bước 11, web theo bước 12 và worker theo bước 13 nếu có thay đổi.
4. Kiểm tra đăng nhập, lưu dữ liệu, mời/duyệt và offline.
5. Không tạo project/database/secret mới chỉ vì cập nhật.

Để mở cho gia đình sau giai đoạn thử, dùng project production riêng với cấu hình được bàn giao cho môi trường đó. Các lệnh ở đây dùng staging; không chỉ đổi URL rồi coi đã hoàn thành production.

Nếu web lỗi: Firebase Hosting → chọn release tốt trước → **Roll back**. Kiểm tra cả API tương ứng; dữ liệu và worker không tự quay lại theo website. [Quản lý release](https://firebase.google.com/docs/hosting/manage-hosting-resources).

## 17. Gặp lỗi thì xem ở đâu?

- **Không thấy project:** kiểm tra email Google và tìm bằng Project ID.
- **node/npm/gcloud không nhận:** đóng/mở terminal sau cài; kiểm tra PATH. Riêng `npm.ps1` bị chặn có thể dùng `npm.cmd`.
- **Thiếu quyền:** phân biệt người deploy, build account và runtime account; gửi lỗi cho người quản lý quyền, không mở quyền database cho mọi người.
- **Build/deploy thất bại:** Cloud Build → History; Cloud Run → tên service → Logs.
- **Google unauthorized domain:** thêm đúng hostname vào Authentication của đúng project.
- **Web mở nhưng không lưu:** kiểm tra bản cloud, Project ID và bước deploy quyền dữ liệu.
- **Thiếu index:** Firestore → Indexes, kiểm tra index đã tạo xong.
- **Thiếu file cấu hình:** bản cloud chưa đủ, bên phát triển bổ sung; bạn không cần viết source.
- **Không nhắc khi app đóng:** xác nhận FCM đã được tích hợp; scheduler chưa đủ.
- **Chi phí tăng:** Billing → Reports/Cost table, lọc đúng project. Pause lịch nhắc nếu đang chạy sai, kiểm tra trước khi tăng quota.

Khi cần hỗ trợ, gửi bước đang làm, thông báo lỗi và Project ID. Che mật khẩu, khóa bí mật, token và dữ liệu gia đình.

## 18. Phạm vi kiểm chứng

Code có thể build cloud trên máy; các bước phát hành cần kiểm chứng OAuth, IAM, index và tác vụ nhắc trên môi trường thử. Chưa có tài khoản, billing hoặc tài nguyên cloud nào được tạo/thay đổi trong lượt triển khai code này.

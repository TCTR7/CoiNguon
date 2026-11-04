# Kế hoạch đăng nhập và mời tham gia gia phả

Trạng thái: chủ dự án đã duyệt bước 1–4; đang triển khai và kiểm thử local. Bước 5 cần Firebase project thử riêng, chưa triển khai cloud.

## 1. Mục tiêu và phạm vi

Người lớn tuổi đăng nhập bằng Google, khai số điện thoại và nhận lời mời ngay trong app. Admin mời từ một hồ sơ người còn sống trên cây; không cần biết Gmail hoặc gửi link Zalo. Không gửi SMS, OTP email hoặc tin nhắn bên ngoài tự động.

- Google xác thực tài khoản. Số điện thoại là thông tin tự khai, bắt buộc để hoàn tất tài khoản; luôn ghi rõ chưa xác minh quyền sở hữu số.
- Một tài khoản Cội Nguồn dùng một số điện thoại; một số chỉ được gắn với một tài khoản tại một thời điểm. Đăng nhập lại cùng Google giữ nguyên tài khoản và quyền.
- Account, hồ sơ người và membership tiếp tục độc lập. Người đã mất/trẻ nhỏ vẫn có hồ sơ không tài khoản; người tạo gia phả không cần là người gốc cây.
- Người nhận phải phản hồi, sau đó admin xác nhận đúng người trước khi cấp quyền. Nhận lời mời không tự cấp admin/editor.
- Một tài khoản có thể tham gia nhiều gia phả; liên kết với hồ sơ được quản lý riêng trong từng gia phả.
- Làm và kiểm thử trên Emulator trước. Tích hợp Google thật cần Firebase project riêng và kiểm tra cấu hình; deploy, billing và mời người thật nằm ngoài lần duyệt triển khai local này.

## 2. Luồng sử dụng cần đạt

### Người tạo gia phả

Tiếp tục với Google → nhập tên hiển thị và số điện thoại → hoàn tất tài khoản → tạo gia phả → nhận vai trò admin ban đầu. Không cần người khác duyệt người tạo; quyền chỉ áp dụng cho gia phả vừa tạo. Chưa khai số vẫn được đăng xuất hoặc sửa thông tin, chưa được tạo/nhận quyền gia phả mới.

### Admin mời người từ cây

Chọn hồ sơ còn sống → nhập số điện thoại → bấm “Mời tham gia” → xem trạng thái tại hồ sơ. Lưu số liên hệ và gửi lời mời là hai thao tác rõ ràng; sửa trường liên hệ không âm thầm tạo/đổi lời mời.

- Tài khoản đã khai số: lời mời xuất hiện trong hộp thư của tài khoản đó khi online.
- Chưa có tài khoản khai số: lời mời chờ, được tìm lại khi có tài khoản hoàn tất đăng ký số tương ứng; không cần admin gửi lại.
- Admin chỉ thấy trạng thái của lời mời mình quản lý, không có chức năng tra danh bạ tài khoản toàn hệ thống hoặc lấy Gmail từ số bất kỳ.
- Không cho mời hồ sơ đã mất, chưa rõ còn sống, đã lưu trữ hoặc đã liên kết tài khoản khác. Có thể sửa trạng thái còn sống khi đã xác nhận dữ liệu.

### Người nhận và admin xác nhận

Đăng nhập Google → hoàn tất số điện thoại → mở “Lời mời của tôi” → “Đây là tôi — yêu cầu tham gia” hoặc “Không phải tôi”.

Trước khi được duyệt, người nhận chỉ thấy thông báo có lời mời và mã tham chiếu; chưa thấy tên gia phả, tên admin, hồ sơ đích, thế hệ hoặc danh sách thành viên. Đây là đánh đổi quyền riêng tư do số chưa được xác minh.

Sau phản hồi, admin đúng gia phả thấy tên và email Google của người nhận, số đã khai và hồ sơ đích. UI yêu cầu admin xác nhận đã đối chiếu đúng người; khi chưa chắc phải hỏi người thân qua kênh đã biết. Tên/email do backend lấy từ Auth, không tin giá trị client tự gửi. Không đưa email vào roster mà thành viên thường đọc.

Admin duyệt → một giao dịch tạo membership vai trò member, liên kết tài khoản với hồ sơ, chốt lời mời. Nếu đã là thành viên thì giữ nguyên vai trò/epoch; chỉ liên kết hồ sơ khi hợp lệ. Sau đó người nhận mới thấy dữ liệu gia phả. Admin có thể đổi vai trò bằng chức năng quản trị hiện có.

### Trạng thái trên UI

- Hồ sơ: “Chưa mời”, “Đã mời — chờ phản hồi”, “Chờ admin xác nhận”, “Đã tham gia”, “Đã từ chối”, “Đã thu hồi” hoặc “Cần mời lại”.
- Tài khoản: “Số điện thoại chưa xác minh”; không dùng dấu xác thực số dựa vào đăng nhập Google.
- Không hiển thị “chưa đăng ký” như sự thật đã xác minh về một người; chỉ biết số đó đã/chưa được một tài khoản khai trong app.
- Lời mời trong app không có link và đề xuất không tự hết hạn theo số ngày trong pilot. Admin được thu hồi; mỗi lần phản hồi/duyệt vẫn kiểm tra quyền và hồ sơ hiện tại. Gỡ người tạo lời mời khỏi vai trò admin làm lời mời chưa hoàn tất mất hiệu lực; admin còn quyền cần mời lại.

## 3. Số điện thoại, đổi số và tài khoản trùng

- Pilot nhận số di động Việt Nam; chuẩn hóa đầu 0 và +84 về cùng dạng E.164. Nêu rõ giới hạn này trên form; tách bộ chuẩn hóa để mở rộng quốc gia sau, không rải quy tắc trong UI.
- Đặt số bằng transaction tại backend, kể cả hai tài khoản đăng ký đồng thời chỉ một tài khoản giữ số. Client không tự ghi hoặc truy vấn chỉ mục số.
- Khi trùng số: thông báo chung “Không thể sử dụng số này. Kiểm tra lại hoặc liên hệ hỗ trợ”, không tiết lộ tài khoản đang giữ số; không tự gộp hoặc chuyển quyền.
- Cho đổi số sau khi đăng nhập Google lại; tăng phiên bản liên kết số và giải phóng số cũ nguyên tử. Giữ nguyên membership/personLinks hiện có vì chúng gắn UID, không gắn số.
- Lời mời chưa hoàn tất đã gắn UID/phiên bản số cũ chuyển “Cần mời lại”, không chuyển sang tài khoản nhận số cũ sau này. Tài khoản mới chỉ có thể phản hồi lời mời mới được admin phát hành lại.
- Nếu bị khai nhầm/chiếm số: pilot có quy trình hỗ trợ thủ công của người vận hành, đối chiếu với các bên trước khi giải phóng. Admin gia phả không được tự chiếm số hoặc xem/sửa tài khoản toàn hệ thống. Chưa có bằng chứng thì không tự chuyển; không ép xóa tài khoản, không xóa dữ liệu gia phả để xử lý số.
- Phạm vi đợt này: một Google account cho một tài khoản Cội Nguồn. Liên kết thêm Google thứ hai và khôi phục khi mất Google là phần sau, chưa tự gộp theo số/email. Cần thiết kế riêng nếu mở rộng; không mặc định API liên kết nhiều provider hỗ trợ hai danh tính Google cùng provider.

## 4. Dữ liệu và ranh giới quyền dự kiến

Tên collection/API dưới đây là dự kiến, chốt khi triển khai và cập nhật trực tiếp trong ARCHITECTURE.md.

- `accounts/{uid}`: thông tin onboarding, số chuẩn hóa, phiên bản liên kết, mốc cập nhật; nguồn danh tính là Firebase UID. Đăng nhập Google không đồng nghĩa có membership.
- `phoneClaims/{phoneKey}`: chỉ mục duy nhất số → UID, chỉ backend truy cập. Dùng HMAC của số chuẩn hóa với khóa server để làm khóa tra; không dùng số thô trong URL/ID hoặc SHA đơn thuần để che số có thể dò được.
- `personContacts` riêng từng clan: số do admin khai cho hồ sơ; giới hạn admin truy cập, không thêm vào collection people mà mọi thành viên đọc được. Không tự đồng bộ số này giữa các gia phả/tài khoản.
- `membershipInvites`: clan/person, khóa số đích, UID đích khi đã đối chiếu, phiên bản liên kết số, trạng thái/version, người tạo/duyệt và mốc xử lý. Phân trang hộp thư/danh sách duyệt; không tải toàn bộ tài khoản để lọc số ở frontend.
- Endpoint tài khoản/hộp mời bắt buộc kiểm tra token và chỉ trả dữ liệu của chính UID. Quản trị lời mời kiểm tra admin trong đúng clan. Rules chặn đọc/ghi trực tiếp các collection mới; DTO chỉ trả trường cần thiết cho từng bên.
- Phản hồi và duyệt dùng version/idempotency; ràng buộc UID + phiên bản số chặn thao tác cũ. Duyệt tái kiểm tra số hiện tại, người nhận, quyền admin, hồ sơ, liên kết hiện có và membership trong transaction; không trả thành công một phần.
- Kết hợp khóa quản trị membership và khóa gia phả hiện có khi cần, để duyệt mời không tranh chấp với gỡ quyền admin, lưu trữ hồ sơ hoặc nhận hồ sơ. Không ghi đè vai trò cũ; hồ sơ đã liên kết người khác phải báo xung đột.
- Không dùng số để đăng nhập/khôi phục mật khẩu hoặc tự nhận lại quyền sau khi rời/bị gỡ. Không lưu số, email hoặc lời mời vào bản tải offline, bản xuất gia phả, thông báo màn hình khóa, log request hay đường dẫn.
- Định danh đã tồn tại trong dữ liệu demo giữ nguyên UID. Không tự di chuyển tài khoản email local sang Google thật hoặc đụng dữ liệu production.

## 5. Thứ tự triển khai và điều kiện hoàn thành

### Bước 1 — Đăng nhập Google giả lập và hoàn tất tài khoản

Mở rộng `src/shared/firebase/client.ts`, feature workspace và backend tài khoản; thêm form tên/số, chuẩn hóa, chỉ mục duy nhất, đổi số và trạng thái chưa hoàn tất. Local mặc định vẫn dùng project demo; Google giả lập được gắn nhãn rõ. Cách tạo phiên `.test` hiện có chỉ phục vụ fixture/local trong thời gian chuyển đổi, không được trở thành đường bỏ qua onboarding.

Hoàn thành khi: đăng nhập/đăng xuất/reload đúng UID; trùng số và thao tác đồng thời bị chặn; lỗi/hủy đăng nhập không mất dữ liệu form; tài khoản chưa hoàn tất không vượt chặn bằng API/rules. Phiên trên thiết bị riêng giữ đăng nhập khi người dùng chọn; mặc định và xóa cache giữ chính sách hiện có.

### Bước 2 — Backend mời theo số và duyệt nguyên tử

Thêm API/collection/rules mới, inbox có phân trang, đối chiếu lời mời tạo trước hoặc sau đăng ký. Tái sử dụng membership/personLinks và kiểm tra người sống, chống liên kết nhầm. Thêm giới hạn tần suất và đầu vào cho khai/đổi số, tạo mời, hộp thư và phản hồi; không có API tra toàn bộ người dùng theo số.

Hoàn thành khi: không mở dữ liệu trước duyệt; nhận/duyệt lặp chỉ tạo một membership/link; đổi số, thu hồi và mất quyền admin chặn được request cũ, kể cả đồng thời.

### Bước 3 — UI xuyên suốt cho admin và người nhận

Thêm “Mời tham gia” tại hồ sơ cây, danh sách trạng thái và màn duyệt; “Lời mời của tôi” xuất hiện cả khi chưa thuộc gia phả nào. Giữ phong cách giấy ngà/đỏ son, chữ dễ đọc và hành động có nhãn; có loading/rỗng/lỗi/offline. Offline chỉ đọc phần đã tải, không phản hồi/duyệt hoặc xếp hàng ghi.

Hoàn thành khi: demo được từ admin chọn người trên cây → tài khoản khác thấy lời mời → phản hồi → admin duyệt → đúng hồ sơ và gia phả; kiểm tra 320px, chữ 200%, bàn phím và axe. Người khai nhầm có thể từ chối mà không thấy dữ liệu riêng.

### Bước 4 — Tương thích luồng cũ và hồi quy

Link đăng ký chung hiện có giữ như lối phụ tùy chọn và vẫn cần duyệt; áp dụng chặn onboarding. Đường nhận link riêng hiện đang cấp member/editor trực tiếp phải chuyển sang chờ admin xác nhận, gồm API/rules, không chỉ ẩn nút. Link thiệp giỗ/RSVP tiếp tục độc lập, khách không bắt buộc Google hoặc số điện thoại.

Cập nhật fixture/page object theo cấu trúc feature hiện có, không xóa kiểm thử quyền để làm suite chạy qua. Cập nhật PRD/ARCHITECTURE/DEVELOPMENT/TESTING theo hành vi thực tế; PROJECT_STATE chỉ thay snapshot ngắn khi có tiến độ code.

### Bước 5 — Kiểm chứng Google thật trước pilot công khai

Sau khi có Firebase project thử riêng và phạm vi cho phép cloud: tách cấu hình local/cloud của client và backend, cấu hình Google provider/domain, kiểm tra token thật. Thử Android/Chrome, iPhone/Safari/PWA và trường hợp mở từ trình duyệt trong Zalo; hướng dẫn mở trình duyệt hệ thống khi cần. Kiểm tra phiên, logout, từ chối quyền, popup/redirect và quay lại đúng màn.

Đây là mốc kiểm tra ngoài Emulator, không được ghi hoàn thành từ Google giả lập. Chưa có project thì bước 1–4 vẫn demo và kiểm thử local được; phát hành Internet cần kế hoạch backend/deploy riêng và kiểm tra chống lạm dụng. Không bật dịch vụ tính phí chỉ để hoàn tất plan local.

## 6. Kiểm thử bắt buộc khi triển khai

1. Hai định dạng 0/+84 cùng một số; đầu vào sai; hai UID giữ cùng số đồng thời; người dùng khác không đọc chỉ mục số.
2. Mời trước đăng ký và sau đăng ký đều vào đúng inbox; một tài khoản nhận mời từ nhiều clan; không dò được hồ sơ/tên clan trước duyệt.
3. Khai nhầm số vẫn chưa có quyền; email/name client giả không thay danh tính từ Auth; admin thấy đúng tài khoản đã phản hồi.
4. Người chưa đăng nhập/chưa khai số, sai UID, sai clan, editor/member hoặc token không hợp lệ không thực hiện được thao tác quản trị; gọi thẳng Firestore không vượt được.
5. Bấm phản hồi/duyệt lặp, retry và hai admin duyệt đồng thời chỉ tạo một kết quả; tranh chấp thu hồi/duyệt, admin mất quyền, hồ sơ đổi trạng thái hoặc có liên kết mới đều kiểm tra lại.
6. Đổi số trước/sau phản hồi; tài khoản khác lấy số cũ; thao tác version cũ bị từ chối; membership cũ không chuyển người. Số bị chiếm không dẫn tới xóa tài khoản tự động.
7. Thành viên sẵn có giữ vai trò khi liên kết hồ sơ; rời/bị gỡ không tự vào lại từ lời mời đã dùng; vẫn bảo vệ admin cuối và dữ liệu các clan khác.
8. Link gia phả cũ không bỏ qua duyệt/onboarding; link khách RSVP vẫn hoạt động độc lập; đăng xuất/đổi Google không lộ inbox hoặc cache phiên trước.
9. Mất mạng chặn mọi ghi; không tải phone/email/inbox vào offline/JSON gia phả; kiểm tra giao diện nhỏ, font lớn và focus/thông báo lỗi.

Unit cạnh mã; API/rules/browser ở `automation_test/features/auth`, `clan_membership`, `clan_joining`, `genealogy` theo miền. Giữ lệnh dễ dùng hiện có như `npm run test:feature -- auth --headed`; mở rộng ca trong feature thay vì bắt người dùng nhớ runner mới.

Khi có code, chạy unit/API/rules, các browser feature bị ảnh hưởng, kiểm tra offline liên quan và build/lint/format. Chạy `npm run test:all` trước nghiệm thu toàn luồng; ghi rõ phần nào chỉ giả lập và phần Google/thiết bị thật chưa chạy. Kết quả triển khai hiện tại xem PROJECT_STATE.md; kiểm thử Google thật vẫn là mốc riêng.

## 7. Các lựa chọn đã được duyệt

- Chấp nhận số tự khai và rủi ro nhập nhầm/chiếm số; admin đối chiếu đúng người là điều kiện bắt buộc trước mở dữ liệu.
- MVP một Google account/tài khoản Cội Nguồn; số di động Việt Nam; cho đổi số thay vì bắt xóa tài khoản; tranh chấp/mất Google xử lý thủ công, chưa có tự gộp tài khoản.
- Inbox trước duyệt chỉ hiện thông báo tối thiểu; lời mời không tự hết hạn theo ngày, được thu hồi và luôn kiểm tra hiệu lực hiện tại.
- Duyệt bước 1–4 để triển khai local trước; Google thật/triển khai Internet thực hiện khi có môi trường và phạm vi cho phép tương ứng.

Tài liệu kỹ thuật để đối chiếu khi triển khai: [Google Sign-In với Firebase](https://firebase.google.com/docs/auth/web/google-signin), [Auth Emulator và nhà cung cấp giả lập](https://firebase.google.com/docs/emulator-suite/connect_auth). Emulator hỗ trợ thử luồng nhà cung cấp bên thứ ba nhưng không chứng minh cấu hình OAuth thật đã hoạt động.

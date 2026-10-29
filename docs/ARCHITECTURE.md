# Kiến trúc dự án

Trạng thái: Frontend mẫu, workspace thành viên, gia phả và lịch giỗ/chủ sự local đã triển khai. Nghiệp vụ chuẩn nằm trong [PRD](PRD_CoiNguon_App.md); không thay thế các quyết định còn mở ở mục 12.

## Baseline hiện hành

Frontend hiện dùng React 19, TypeScript 6, Vite 8 và Tailwind 4; dependency được ghim trong package.json/package-lock.json. Các trang mẫu dùng fixture; /dong-ho kết nối Auth/Firestore Emulator, cố định project demo-coinguon. PWA/service worker hiện có trên bản build để đọc dữ liệu đã tải offline và thử thông báo thiết bị. Firebase Auth, Firestore, Storage và FCM cho dịch vụ nền. Backend tin cậy thực hiện tác vụ định kỳ, chuyển quyền, cấp link khách và các thao tác cần tính nguyên tử. Chọn dịch vụ scheduler, region và phiên bản dependency khi giải quyết OQ-03/OQ-06; chưa có quyết định triển khai cloud.

Tách UI, use-case nghiệp vụ và adapter Firebase. Hàm lịch âm, tổng RSVP và kiểm tra quan hệ cần kiểm thử độc lập khỏi UI/SDK. Không thêm lớp trừu tượng chỉ để dự phòng nhu cầu chưa có.

## Mô hình khái niệm

- Account: định danh đăng nhập; không phải một người trong gia phả.
- Clan và Membership: đơn vị dữ liệu và tư cách/vai trò tài khoản trong dòng họ.
- Person: hồ sơ người thuộc dòng họ; AccountPersonLink là liên kết được duyệt.
- Relationship: liên kết hai Person cùng dòng họ, loại quan hệ và nguồn thông tin.
- AnniversaryRule: quy tắc giỗ của Person; giữ nguyên ngày/lịch gốc.
- Event: lần tổ chức cụ thể, năm giỗ, múi giờ, phiên bản và trạng thái.
- Assignment và DelegationRequest: chủ sự lâu dài hoặc quyền cho một sự kiện.
- InvitationGroup và RSVP: nhóm được mời và một phản hồi hiện tại của nhóm.
- ReminderJob/Delivery: lịch gửi và kết quả theo khóa chống trùng.
- AuditEntry: lịch sử thao tác, không cho client tự sửa.

Mô hình trên còn bao gồm miền chưa triển khai; schema hiện hành cho thành viên và gia phả/lịch giỗ được ghi phía dưới. Thiết kế collection/index theo truy vấn trước khi viết repository. Không nhét toàn bộ cây vào một document. Dữ liệu riêng tư cần document/endpoint riêng nếu không thể cho phép đọc cùng tập trường công khai. Mọi tham chiếu phải được kiểm tra cùng clan.

## Ranh giới tin cậy

Client dùng Auth và data rules cho thao tác được phép. Backend dùng quyền quản trị vẫn phải tự kiểm tra người gọi, membership, vai trò và đầu vào; Admin SDK không thay thế authorization.

Token thiệp riêng phải ngẫu nhiên đủ mạnh, có hạn dùng/thu hồi, lưu dạng hash khi phù hợp. Endpoint khách chỉ trả DTO thiệp tối thiểu, có giới hạn tần suất và không lộ danh sách khách khác. Không đặt token vào analytics/log. Trang có token không được index hoặc cache công khai.

Chuyển quyền và RSVP kiểm tra phiên bản/idempotency trong transaction hoặc cơ chế nguyên tử tương đương. Chống vòng lặp quan hệ phải xử lý cả ghi đồng thời, không chỉ kiểm tra trên snapshot cũ phía client. Tác vụ gửi nhắc kiểm tra lại phiên bản sự kiện, trạng thái và quyền trước gửi; có retry hữu hạn và log lỗi không chứa dữ liệu nhạy cảm.

## Offline và service worker

App shell khác dữ liệu riêng tư. Cache có version, phạm vi và nút xóa. Chỉ bật lưu bền vững sau lựa chọn thiết bị tin cậy. Không dùng cache để quyết định quyền ghi. Kiểm tra membership khi online lại, xóa cache khi đăng xuất/thu hồi được phát hiện.

Tích hợp service worker PWA và FCM có chủ đích để tránh đăng ký worker xung đột. Thử lifecycle cập nhật app, đăng xuất và nhiều tài khoản trên cùng thiết bị. Không giả định ảnh Storage tự nằm trong cache Firestore.

## Vận hành và chi phí

Tách local/emulator, môi trường thử và production. Không dùng dữ liệu thật cho preview. CI kiểm tra trước deploy; production deploy là thao tác riêng có phạm vi cho phép rõ.

Trước pilot: giới hạn tải lên, kiểm tra loại/kích thước ảnh, ngân sách/cảnh báo, chống lạm dụng, sao lưu và diễn tập khôi phục. Cảnh báo ngân sách không phải hard cap; cần giới hạn sử dụng tại ứng dụng. Chọn quota sau khi đo lượng đọc cây, ảnh và lượt gửi nhắc.

## Cấu trúc hiện hành

src/app chứa layout/router; src/features chứa màn hình theo miền; src/shared chứa fixture và thành phần dùng chung. automation_test/features/<feature>/pages và tests gom page object, browser/API/rules theo tính năng; common_setup chứa fixture dùng chung. Unit test giữ cạnh mã trong src/. scripts chứa launcher emulator demo và setup Java portable. Workspace dùng transaction + Firestore Rules cho tạo dòng họ/nhận lời mời; đổi quyền và rời/gỡ thành viên qua API. Backend TypeScript trong backend/ xử lý ghi gia phả và lịch giỗ; client chỉ đọc các collection này qua rules. Storage và các collection chưa triển khai vẫn bị chặn. API sự kiện dùng cùng dịch vụ local; worker nhắc chạy mỗi phút khi API hoạt động.

## Dòng họ và thành viên local

- Đăng nhập thử bằng email .test + mật khẩu trên Auth Emulator; không có cấu hình cloud hoặc fallback production. OQ-01 đăng nhập pilot vẫn mở.
- clans/{id}: name, ownerUid, createdAt. memberships/{clanId}_{uid}: clanId, uid, displayName, role, joinedAt, invitationId. Người dùng truy vấn membership theo uid; roster theo clanId.
- invitations/{token}: tên/ID dòng họ, quyền member/editor, người tạo, thời gian tạo/hết hạn, revoked, acceptedBy. Token ngẫu nhiên 256 bit; đọc đơn lẻ cần đăng nhập và biết token, chỉ admin được liệt kê. Link dùng một lần, tối đa 7 ngày ở rules (UI tạo 6 ngày). Nhận mời và tạo membership bắt buộc nguyên tử.
- /api/memberships xử lý đổi vai trò/gỡ người (admin) và tự rời (mọi thành viên). ownerUid chỉ lưu người tạo, không cấp quyền; quyền luôn theo membership hiện tại. Người tạo được hạ quyền/rời/gỡ khi còn admin khác.
- Mọi đổi quyền và xóa membership dùng transaction đọc/ghi clans/{id}/membershipMeta/lock; đếm admin từ membership hiện tại trước khi giảm admin. Lock khởi tạo lười, dùng được cho clan cũ; client không đọc/ghi. Rules chặn mọi update/delete membership trực tiếp, gồm batch/transaction tự gửi. Tạo clan chỉ bootstrap admin một lần; nhận lời mời/duyệt đăng ký chỉ cấp member/editor.
- Yêu cầu quản trị mang expectedRole, managementVersion (mặc định 0 cho dữ liệu cũ) và epoch joinedAt + invitationId. Đổi vai trò tăng managementVersion; rời rồi tham gia lại không chấp nhận thao tác cũ. Không sửa ownerUid hoặc xóa gia phả khi người tạo rời; không tự khôi phục quyền khi quay lại.
- Phân loại dữ liệu local: roster chỉ tên và vai trò; email chỉ nằm trong Auth và tài khoản của chính người dùng. Chưa nhận dữ liệu hồ sơ thật; OQ-04 lưu giữ/xóa/thông tin nhạy cảm phải chốt trước pilot.
- Tạo clan/nhận lời mời dùng transaction trực tiếp; đổi quyền/rời qua API nguyên tử, không xếp hàng offline. SDK chỉ cache bộ nhớ; UI bỏ qua snapshot từ cache khi xác định membership/quyền. Đổi tài khoản unmount dữ liệu phiên cũ.

## Gia phả local

- API Node tại 127.0.0.1:8787, chỉ kết nối project demo-coinguon và Auth/Firestore Emulator. Xác thực ID token, kiểm tra membership/vai trò trong transaction ở mỗi thao tác. Chỉ chấp nhận browser origin local cổng 5173. npm run dev khởi động API cùng Vite.
- clans/{id}/people: hồ sơ chữ, ngày gốc âm/dương có trường null, nguồn, verified, version, archived. Không gắn account mặc định. Tên trùng chỉ cảnh báo.
- relationships: cha/mẹ–con ruột/nuôi có hướng, vợ/chồng không có hướng và có trạng thái hiện tại/trước đây. Mỗi quan hệ là document riêng.
- genealogyMeta/lock là bộ đếm phiên bản, không chứa cây. Tất cả mutation gia phả đọc/ghi lock trong transaction; việc thêm/khôi phục cạnh kiểm tra toàn đồ thị quan hệ đang hoạt động. Nhờ cùng điểm đồng bộ, hai cạnh được thêm đồng thời không thể lách kiểm tra vòng lặp.
- Sửa hồ sơ/quan hệ cần đúng version. Hồ sơ còn quan hệ hoạt động không được lưu trữ; không xóa dây chuyền. Khôi phục cạnh kiểm tra lại cả hai hồ sơ và chu trình hiện tại.
- personRequests: đề nghị nhận hồ sơ hoặc góp ý; thành viên đọc đề nghị của mình, admin đọc tất cả. personLinks/{personId} liên kết tối đa một account với hồ sơ sau duyệt; liên kết không cấp thêm vai trò. Góp ý không tự ghi đè dữ liệu.
- Sơ đồ hiện là nhánh theo gốc chọn, tính thế hệ tương đối từ quan hệ cha/mẹ–con đã xác minh; nhiều độ sâu hợp lệ thì báo chưa xác định. Danh sách hiển thị 20 hồ sơ/lượt, mỗi tầng sơ đồ tối đa 100 nút. Chưa có layout cây lớn tự động, tải ảnh, mộ phần. Lịch âm được chuyển đổi trong miền lịch giỗ, giữ nguyên hồ sơ gốc.
- Quy mô hiện tại dành cho local/pilot: graph được kiểm tra trong một transaction trên các cạnh của dòng họ. Cần đo lại giới hạn đọc/độ trễ trước dòng họ lớn và trước cloud.

## Lịch giỗ và chủ sự local

- /api/events xác thực token và membership trong transaction, dùng chung genealogyMeta/lock với gia phả. Client chỉ đọc các collection nghiệp vụ trong clan; mọi ghi qua API.
- anniversaryRules/{personId}: loại lịch, lựa chọn tháng nhuận/ngày thiếu, ngày mất gốc tại lúc lưu và version. Adapter lunar-date-vn 1.0.6 đối chiếu ngày âm Việt Nam, kiểm tra chuyển đổi ngược để chặn tháng nhuận không tồn tại. Năm giỗ hỗ trợ 1900–2099; không tự bổ sung ngày/năm gốc còn thiếu. OQ-02 vẫn cần gia đình pilot kiểm chứng phong tục và bộ ngày rộng hơn.
- events/{personId}_{year}: khóa duy nhất theo người/năm lịch giỗ; tách anniversaryDate (ngày dân sự đã đối chiếu), scheduledDate/Time (buổi tổ chức) và sourceDate. Mở lại sự kiện hủy dùng cùng document. Nháp → công bố/hủy; công bố → nháp/hủy/hoàn tất; hủy → nháp; hoàn tất ngừng sửa.
- Bản nháp cho phép chưa chốt giờ, không tự gán nửa đêm. Công bố cần chủ sự còn hoạt động, ngày đã xác nhận theo rule/source hiện tại, giờ/địa điểm/hạn phản hồi. Ngày thủ công khác kết quả tính cần căn cứ. Đổi quy tắc hoặc ngày mất đưa sự kiện đang mở về nháp, bỏ xác nhận. Hạn phản hồi và giờ tổ chức dùng IANA time zone, Temporal chuyển sang instant; giờ mùa hè trùng/thiếu bị từ chối.
- assignments/{personId}: hostUid, hostEpoch (joinedAt + invitationId), version; admin phân công. Rời rồi tham gia lại không tự nhận lại quyền cũ. Đổi chủ sự xóa ủy quyền sự kiện đang mở và tăng phiên bản.
- delegations/{permanent_personId|event_eventId}: một yêu cầu chờ mỗi phạm vi, mặc định 7 ngày; chỉ chủ sự đề nghị, người nhận chấp nhận/từ chối, người gửi/admin hủy. Chấp nhận kiểm tra nguyên tử membership của hai bên, epoch, version phân công và sự kiện. Hết hạn/mất hiệu lực hiển thị ngay theo dữ liệu hiện tại; trạng thái được chốt khi xử lý, chưa có scheduler dọn yêu cầu.
- Ủy quyền đã nhận chỉ quản lý một sự kiện, không chuyển chủ sự lâu dài hoặc tự ủy quyền tiếp. Hoàn tất/hủy/thu hồi hoặc thay chủ sự làm mất quyền. stewardChanges lưu người thao tác, hai bên và thời điểm cho phân công/chấp nhận/thu hồi; đây là dữ liệu nghiệp vụ, không phải nhật ký triển khai.
- Mỗi sửa/chuyển trạng thái sự kiện tăng version và reminderRevision để lịch nhắc cũ mất hiệu lực. Worker kiểm tra lại revision, trạng thái, xác nhận ngày, nguồn/rule, chủ sự và membership/epoch trước ghi hộp nhắc; reminderRevisionAt xác định mốc còn hợp lệ.

## Đăng ký qua link chung local

- /tham-gia#token nhận token ngẫu nhiên 256 bit qua fragment; /api/join/preview chỉ trả tên/ID gia phả, phiên bản và hạn link, không trả dữ liệu gia phả. Các mutation /api/join xác thực tài khoản; thao tác quản trị kiểm tra admin đúng clan trong transaction.
- joinLinks/{sha256(token)} chỉ backend truy cập. clans/{id}/joinSettings/current giữ token để admin sao chép lại, version và hạn 30 ngày; chỉ admin đọc, client không ghi. Mỗi clan có một link hiện hành; thay/thu hồi vô hiệu link trước.
- joinRequests/{clanId}_{uid} giữ tên, lời giới thiệu, linkHash/linkVersion/hạn, trạng thái và version. Người gửi chỉ đọc yêu cầu của mình; admin chỉ đọc hàng chờ của clan mình. Client không ghi trực tiếp.
- Duyệt yêu cầu còn hiệu lực tạo membership role member nguyên tử; không sửa vai trò/epoch nếu tài khoản đã là thành viên. Gửi trùng pending trả lại yêu cầu hiện tại; duyệt/rút dùng version để chống tranh chấp và phát lại. Không tự liên kết Person.
- Chỉ chạy loopback/emulator; chưa có endpoint cloud, đăng nhập thật hay giới hạn tần suất cho endpoint công khai. Phải hoàn tất chống lạm dụng trước khi mở dịch vụ ra Internet.

## Thiệp và phản hồi theo hộ local

- /api/invitations kiểm tra admin/chủ sự/ủy quyền còn hiệu lực, membership epoch và version sự kiện trong transaction; dashboard chỉ qua API, không đọc Firestore từ client. Công bố thiệp riêng với công bố sự kiện, cần xem trước và xác nhận nội dung được chia sẻ.
- clans/{id}/invitationSettings/{eventId}: title/message/contact, published, version và raw token xem chung; invitationGroups/{operationId}: eventId, nhãn hộ, raw token riêng, version thu hồi/cấp lại, response/responseVersion và receipt thao tác gần nhất. Tất cả direct read/write bị chặn. Token ngẫu nhiên 256 bit; guestTokens/{sha256(token)} chỉ backend truy cập, trỏ đúng sự kiện/nhóm và loại view/reply.
- /loi-moi#token dùng fragment, noindex/no-referrer, không lưu bền vững. /api/guest/preview trả DTO nội dung được công bố và phản hồi của đúng nhóm; link xem chung không nhận RSVP. Không trả clan/person/member/nhóm khác. API no-store và ngân sách local trong bộ nhớ: 600 lượt/phút toàn dịch vụ, 120 lượt/phút/token; trước Internet cần cơ chế chống lạm dụng dùng chung và chốt OQ-05.
- Hạn link local = startsAtUTC hiện tại + 7 ngày. Mỗi lần đọc/gửi kiểm tra thu hồi, trạng thái thiệp/sự kiện, ngày gốc/rule/đối chiếu hiện tại và chủ sự còn hoạt động. Hủy chỉ trả thông báo hủy; nháp/rút/nguồn ngày cũ tạm đóng; hoàn tất chỉ đọc. Đổi ngày giờ/địa chỉ phản ánh trên link cũ; tiêu đề/lời mời/liên hệ sửa riêng trong trình soạn thiệp.
- Phản hồi là một giá trị hiện tại trên nhóm, không cộng dồn counter. Ghi dùng responseVersion + event/card version và operationId/fingerprint; retry cùng nội dung trả receipt, tranh chấp báo 409. Sau hạn chỉ manager được ghi và phải có lý do; hoàn tất/hủy không ghi. Thu hồi/cấp lại không xóa phản hồi; tổng hợp tính từ toàn bộ nhóm, gồm nhóm có link đã thu hồi.
- Giới hạn local: tổng tối đa 500 người/nhóm, số nguyên không âm; không tham dự có số người bằng 0. Gợi ý mâm làm tròn lên theo 1–30 chỗ do người tổ chức nhập. Dashboard cập nhật khi thao tác/tải lại và 15 giây khi tab hiện; trang khách đối chiếu lại mỗi 30 giây, mọi ghi vẫn kiểm tra tại server. Không gửi lời mời ra ngoài; worker nhắc local chỉ ghi hộp nhắc trong ứng dụng.

## Nhắc, PWA và dữ liệu local

- API /api/reminders xác thực bearer/membership; người dùng chỉ đọc/đánh dấu hộp nhắc của mình. Admin xem số job và chạy quét; không nhận clock từ client. API quét mỗi 60 giây; dừng API thì không có tác vụ nền.
- Mốc 7/3 ngày lúc 09:00 theo timezone sự kiện, lưu UTC; bỏ mốc đã qua khi công bố/đổi revision. Cửa sổ thực hiện 24 giờ và trước giờ tổ chức. Khóa gồm clan/event/revision/mốc/UID/epoch; lease 60 giây, tối đa 3 lần, chờ 1 rồi 5 phút giữa các lần. Ghi inbox và trạng thái delivered trong một transaction; thu hồi/đổi ngày vô hiệu lời nhắc cũ.
- Một service worker /sw.js cho app shell và thông báo thử; bản build sinh danh sách tài nguyên tĩnh kèm hash version. Không cache HTTP API, Firestore, trang /loi-moi, /tham-gia hoặc URL có query. Worker mới chỉ kích hoạt sau thao tác cập nhật của người dùng; không tự tải lại form.
- IndexedDB coinguon-private-v1 tách snapshots theo UID/clan và epoch, settings theo thiết bị, receipts chống thông báo lặp. Download cần chọn thiết bị riêng và duy trì đăng nhập bằng browserLocalPersistence; mặc định đăng nhập mới vẫn session, kể cả sau tài khoản đã chọn thiết bị tin cậy; khi reload có thể đọc lại phiên local đã được chọn. Firestore vẫn memory cache. Snapshot chỉ gồm hồ sơ chữ, quan hệ, quy tắc và lịch; không chứa token/khách mời/phân quyền.
- /ngoai-tuyen chỉ đọc và tìm hồ sơ; /dong-ho đóng các màn ghi khi navigator báo offline. Khi online, reader xác minh epoch qua API trước khi hiển thị; membership server snapshot cũng dọn bản đã mất quyền. Đăng xuất xóa IndexedDB riêng và đóng thông báo, giữ app shell công khai. Không thể thu hồi ngay bản trên thiết bị mất mạng.
- Thông báo thiết bị chỉ bật bằng thao tác cấp quyền, UI chờ worker xác nhận kết quả thử, nội dung màn khóa chung; kiểm tra UID hiện hành và receipt trước hiện. Đây là thử local khi mở app, chưa có FCM/subscription/scheduler cloud; chưa bảo đảm nhận khi app đóng.
- API /api/data: thành viên tải snapshot/kiểm tra epoch; admin xuất JSON schemaVersion=1 hoặc kiểm tra/khôi phục bản sao. Hạn mức local 8 MB, 1.000 hồ sơ, 5.000 quan hệ, 1.000 quy tắc, 2.000 sự kiện; schema whitelist, kiểm tra ID/tham chiếu/vòng lặp, giữ ngày và lịch gốc.
- Khôi phục luôn tạo clan restore_ mới trong Emulator. Restore session khóa UID/operationId/fingerprint, lease 5 phút; ghi staging theo lô 250, sau cùng kiểm tra lại admin/epoch rồi tạo parent và đúng một membership admin. Rules dành riêng prefix restore_, chặn client chiếm staging; lỗi giữa chừng chưa kích hoạt clan, thử lại cùng operation có thể tiếp tục. Không ghi đè nguồn; sự kiện về nháp/chưa xác nhận, không mang chủ sự, tài khoản, quyền, token hay khách mời.
- JSON này là bản sao gia phả/lịch cơ bản; chưa thay backup toàn bộ Auth/Storage/RSVP hoặc chính sách lưu giữ trên cloud. Cloud backup, push nền, giới hạn vận hành và QA thiết bị thật còn là điều kiện trước pilot.

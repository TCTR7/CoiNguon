# PRD — Cội Nguồn

Phiên bản: 0.3 · Cập nhật: 2026-10-30 · Trạng thái: MVP đang triển khai local; tiến độ xem PROJECT_STATE.md.
Tên làm việc: Cội Nguồn; tên thương mại chưa chốt. Nền tảng: PWA, ưu tiên di động.

## 1. Bài toán và mục tiêu

Giúp một gia đình/chi họ lưu giữ gia phả, biết ngày giỗ sắp tới, xác định người phụ trách và tổng hợp số người dự giỗ. Giá trị cốt lõi là nối dữ liệu gia phả với công việc tổ chức giỗ thực tế.

Đối tượng thử nghiệm đầu tiên là người đang giữ gia phả hoặc tổ chức giỗ; người lớn tuổi cần thao tác đơn giản, con cháu cần xem lịch và phản hồi lời mời. Người quản lý dữ liệu, người sử dụng và người trả tiền có thể khác nhau.

Ưu tiên đúng dữ liệu, quyền riêng tư và thao tác dễ hiểu. Tối ưu chi phí ban đầu; không cam kết hạ tầng miễn phí tuyệt đối. Các hạn mức và chính sách ở mục 12 là đề xuất cần kiểm chứng, không phải quyết định thương mại đã duyệt.

## 2. Phạm vi

### MVP

- FR-01: Tạo dòng họ, đăng nhập, mời và quản lý thành viên, phân quyền.
- FR-02: Tạo/sửa hồ sơ người, quan hệ gia đình, tìm kiếm và xem gia phả.
- FR-03: Lịch giỗ theo ngày gốc âm/dương lịch; sự kiện tổ chức theo từng năm.
- FR-04: Gán chủ sự, chuyển quyền có xác nhận; ủy quyền một sự kiện.
- FR-05: Thiệp mời qua link, RSVP theo hộ/nhóm khách và tổng hợp số người.
- FR-06: Lịch sắp tới trong app, nhắc push khi thiết bị hỗ trợ và đã cấp quyền.
- FR-07: Xem ngoại tuyến dữ liệu đã tải, lịch sử thay đổi quan trọng và xuất bản sao dữ liệu cơ bản.

### Sau MVP

- Quỹ dòng họ: sổ thu chi, chứng từ, duyệt khoản chi, đối soát và lịch sử điều chỉnh.
- Xuất PDF gia phả mỹ thuật để in; nhập dữ liệu hàng loạt; gộp hồ sơ trùng có kiểm soát.
- Tư liệu video/ghi âm/PDF, mẫu thiệp trả phí và gói lưu trữ.
- Ủy quyền theo khoảng thời gian và nhiều cấp phân cấp Chi/Phái phức tạp.

### Chưa triển khai

Đặt cỗ, dịch vụ mộ phần, thanh toán và thu phí giao dịch, white-label, tự động nhắn Zalo/Messenger, đồng bộ ghi ngoại tuyến, liên kết hồ sơ xuyên dòng họ. Chia sẻ link thủ công không đồng nghĩa tích hợp API nhắn tin.

## 3. Vai trò và phạm vi quyền

Mọi quyền gắn với một dòng họ; một tài khoản có thể tham gia nhiều dòng họ. Mặc định từ chối truy cập ngoài phạm vi được cấp.

- Quản trị viên: quản lý thành viên/vai trò, sửa gia phả, gán chủ sự, xử lý đề nghị nhận hồ sơ, xuất dữ liệu và xem nhật ký. Không được loại bỏ quản trị viên cuối cùng.
- Biên tập viên: tạo/sửa hồ sơ và quan hệ; không cấp quyền hoặc quản lý thành viên.
- Thành viên: xem thông tin nội bộ được phép, gửi đề nghị sửa/nhận hồ sơ, phản hồi lời mời của mình.
- Chủ sự: quyền bổ sung cho người phụ trách một người đã khuất; quản lý sự kiện liên quan. Không tự có quyền sửa gia phả hoặc cấp quyền quản trị.
- Người được ủy quyền một sự kiện: quản lý sự kiện đó, không thay thế chủ sự lâu dài.
- Khách qua link: chỉ xem nội dung thiệp được công bố và phản hồi nhóm khách tương ứng; không được xem gia phả hoặc danh sách RSVP khác.

Thủ quỹ và người duyệt chi chỉ được thiết kế khi triển khai giai đoạn quỹ. Quyền phải được kiểm tra ở lớp dữ liệu/backend, không chỉ ẩn nút trên UI.

## 4. Hồ sơ và quan hệ gia đình — FR-01, FR-02

Phương thức pilot: đăng nhập Google và hoàn tất tên/số di động Việt Nam bắt buộc; một số chuẩn hóa chỉ liên kết một tài khoản Cội Nguồn tại một thời điểm. Số tự khai chưa xác minh quyền sở hữu; không dùng SMS hoặc OTP email. Đăng nhập Google không xác minh số điện thoại và không tự cấp quyền gia phả. Bản local dùng Google giả lập hoặc email .test cho fixture; Google thật cần cấu hình project và kiểm chứng riêng.

Tài khoản đăng nhập khác hồ sơ người. Hồ sơ không bắt buộc có tài khoản; người đã khuất và trẻ nhỏ vẫn có hồ sơ. MVP lưu hồ sơ độc lập trong từng dòng họ; không tự đồng bộ người trùng giữa họ nội và họ ngoại.

Người tạo gia phả là quản trị viên ban đầu, không bắt buộc là trưởng tộc hoặc người gốc của cây; có thể thêm hồ sơ người đã mất và cấp admin cho tài khoản thành viên khác. Không bắt buộc liên kết tài khoản với hồ sơ để tham gia. Bàn giao bằng cách cấp quyền admin cho thành viên khác, sau đó người tạo có thể hạ quyền hoặc rời gia phả. Admin khác cũng có thể đổi quyền/gỡ người tạo. Luôn giữ ít nhất một admin, kể cả khi thao tác đồng thời; tên người tạo không tạo đặc quyền vĩnh viễn. Rời gia phả không xóa hồ sơ người hoặc quan hệ. Người quay lại cần được mời/duyệt mới, không tự khôi phục quyền cũ.

Luồng chính: admin chọn hồ sơ còn sống, nhập số và chủ động tạo lời mời trong app. Lưu số liên hệ riêng không tự gửi mời. Mời trước đăng ký được giữ chờ; khi tài khoản khai số tương ứng, hộp thư chỉ hiện thông báo tối thiểu và mã tham chiếu, chưa lộ gia phả/hồ sơ. Người nhận phản hồi “Đây là tôi” hoặc từ chối; admin xem tên/email từ Auth và đối chiếu qua kênh đã biết trước khi duyệt. Duyệt tạo membership member và liên kết hồ sơ nguyên tử; giữ nguyên quyền của người đã là thành viên. Không mời hồ sơ đã mất/chưa rõ còn sống/lưu trữ/đã liên kết. Số liên hệ chỉ dành cho admin, tách khỏi hồ sơ mà thành viên thường đọc.

Đổi số cần đăng nhập lại, không xóa tài khoản hoặc chuyển membership. Lời mời đã gắn với lần khai số cũ không chuyển sang người nhận số đó sau này; cần admin mời lại. Trùng/chiếm số được hỗ trợ thủ công bởi người vận hành, không tự gộp tài khoản. MVP dùng một Google account/tài khoản; liên kết Google thứ hai chưa thuộc đợt này. Lời mời theo số không tự hết hạn theo ngày, có thể thu hồi; hồ sơ không còn hợp lệ hoặc người tạo mất quyền admin làm lời mời chưa hoàn tất mất hiệu lực.

Lối phụ qua link: admin tạo link đăng ký dùng chung để tự chia sẻ lên nhóm Zalo. Người mở link chỉ thấy tên gia phả và form đăng ký; đăng nhập rồi gửi tên cùng lời giới thiệu quan hệ gia đình. Yêu cầu chờ duyệt không cấp quyền đọc gia phả. Admin duyệt từng người; khi được duyệt, tài khoản nhận vai trò thành viên trong đúng gia phả, không tự nhận hồ sơ hoặc quyền admin. Người không có membership không được xem cây, hồ sơ hoặc danh sách thành viên, kể cả khi biết ID gia phả.

Link chung local có hạn 30 ngày, có thể thu hồi hoặc thay mới; link cũ mất hiệu lực và yêu cầu từ link cũ không được duyệt tiếp. Việc thu hồi link không xóa quyền người đã được duyệt. Gửi lặp không tạo thêm yêu cầu; duyệt và cấp membership là một giao dịch nguyên tử. Người gửi xem trạng thái và có thể rút yêu cầu chờ. Sau từ chối cần trao đổi với admin và dùng link mới để gửi lại. Link mời riêng dùng một lần cũng tạo yêu cầu chờ duyệt, không trực tiếp cấp member/editor; không đăng công khai trong nhóm. Link đăng ký khác link thiệp/RSVP.

Hồ sơ gồm tên hiển thị, tên khác nếu có, trạng thái còn sống/đã mất/chưa rõ, ngày sinh/mất, ảnh tùy chọn, tiểu sử, thông tin mộ phần tùy chọn. Lưu ngày gốc, loại lịch, mức độ đầy đủ và nguồn thông tin; không tự điền ngày/tháng/năm còn thiếu. Thông tin chưa xác minh phải được đánh dấu.

Quan hệ được lưu riêng, hỗ trợ cha/mẹ–con với loại sinh học hoặc nuôi, và quan hệ vợ/chồng có trạng thái. Cho phép chưa rõ cha/mẹ, tái hôn và dữ liệu thiếu. Chặn quan hệ với chính mình và vòng lặp tổ tiên. Không suy ra quan hệ huyết thống chỉ từ họ tên. Chưa hỗ trợ tự động suy luận danh xưng họ hàng phức tạp.

Người dùng gửi đề nghị liên kết tài khoản với hồ sơ; quản trị viên xác nhận. Một hồ sơ có tối đa một tài khoản liên kết đang hoạt động trong MVP. Nhận hồ sơ không tự cấp quyền biên tập. Cảnh báo tên/ngày trùng chỉ gợi ý kiểm tra, không tự gộp.

Hiển thị danh sách tìm kiếm bên cạnh sơ đồ; người dùng không phải kéo cây lớn để tìm người. Sơ đồ phải kéo/cuộn và thu phóng được trên máy tính/điện thoại, mở/thu nhánh và mở thêm thế hệ. Không ấn định trần số người hoặc số thế hệ trong chức năng gia phả; dữ liệu tăng không yêu cầu sửa hằng số trong code. Chỉ dựng phần đang xem, giữ danh sách dễ đọc để định vị người ở cây lớn. Đời được tính theo gốc hiển thị và quan hệ đã xác minh; không hiển thị một số đời chắc chắn khi dữ liệu chưa đủ. Chi có thể là nhãn lọc; phân cấp Tộc/Chi/Phái đầy đủ để sau MVP.

## 5. Lịch giỗ và sự kiện — FR-03

Tách ba khái niệm: ngày mất gốc; quy tắc giỗ lặp lại hằng năm; ngày tổ chức thực tế của sự kiện. Thay đổi ngày tổ chức không sửa ngày mất.

- Ngày gốc ghi rõ âm/dương lịch; ngày âm lưu cờ tháng nhuận. Chỉ chuyển đổi đầy đủ khi dữ liệu đủ và thuật toán hỗ trợ.
- Giỗ âm lịch tính theo lịch Việt Nam, múi giờ Asia/Ho_Chi_Minh. Lưu ngày dạng ngày lịch, không ép thành UTC nửa đêm gây lệch ngày.
- Với tháng nhuận hoặc ngày 30 không tồn tại trong năm đích: quản trị viên/chủ sự phải chọn quy tắc đã được giải thích, hoặc xác nhận ngày của năm đó. Khi chưa xác nhận, hiển thị cần xác nhận và không tự gửi nhắc.
- Các lựa chọn tháng nhuận cần hỗ trợ: dùng tháng thường cùng số; dùng tháng nhuận nếu có, nếu không dùng tháng thường. Ngày 30 thiếu: chọn ngày cuối tháng hoặc ngày tổ chức thủ công. Không áp một phong tục cho mọi gia đình.
- Một người đã khuất có tối đa một sự kiện giỗ thường niên đang hoạt động cho mỗi năm giỗ trong MVP; dùng khóa duy nhất để tránh tạo trùng.
- Sự kiện có trạng thái nháp, đã công bố, đã hủy, hoàn tất; gồm ngày/giờ, múi giờ địa điểm, địa chỉ, chủ sự, hạn RSVP và nội dung thiệp.
- Chưa chọn ngày tổ chức thì chỉ hiển thị ngày giỗ dự kiến; nhắc 7/3 ngày dựa trên sự kiện đã công bố và ngày tổ chức đã xác nhận.
- Khi đổi lịch/hủy: vô hiệu lịch nhắc cũ, tăng phiên bản sự kiện, cập nhật link thiệp. Thông báo thay đổi lịch tách khỏi nhắc định kỳ.

## 6. Chủ sự và chuyển giao — FR-04

Quản trị viên chỉ định một thành viên đang hoạt động làm chủ sự cho người đã khuất. Lưu người thao tác, thời điểm và lịch sử.

Chuyển lâu dài dùng yêu cầu pending → accepted/rejected/cancelled/expired. Chủ sự cũ còn quyền đến khi yêu cầu được chấp nhận. Chấp nhận phải kiểm tra lại quyền của người gửi, tư cách thành viên của người nhận và phiên bản phân công trong một thao tác nguyên tử. Một phân công chỉ có một yêu cầu chờ; yêu cầu hết hạn sau 7 ngày theo mặc định đề xuất.

Ủy quyền MVP chỉ cho một sự kiện, cũng cần người nhận xác nhận; kết thúc khi sự kiện hoàn tất/hủy hoặc bị thu hồi. Không tự chuyển chủ sự của các năm tiếp theo. Khi người phụ trách rời dòng họ, yêu cầu chờ mất hiệu lực; quản trị viên nhận cảnh báo cần phân công lại. Quyền quản lý của quản trị viên luôn cho phép xử lý trường hợp này và được ghi nhật ký.

## 7. Thiệp mời và RSVP — FR-05

Chủ sự tạo thiệp tối giản, xem trước rồi công bố. Có link chung chỉ để xem và link riêng theo hộ/nhóm khách để phản hồi. Link riêng là quyền truy cập có thể bị chuyển tiếp; phải cảnh báo chủ sự, có thể thu hồi/cấp lại, và không chứa dữ liệu gia phả.

Công bố trong dòng họ và công bố thiệp khách là hai thao tác riêng. Người quản lý xem trước tiêu đề, lời mời, ngày/giờ/múi giờ, địa chỉ và liên hệ tùy chọn, rồi xác nhận cho phép người có link xem. Không tự công bố tên dòng họ, hồ sơ, danh sách thành viên hoặc nhóm khách khác. Khách phản hồi qua link riêng không cần tài khoản và không được cấp membership.

Mỗi nhóm khách có một phản hồi hiện tại: chưa phản hồi, tham dự, không tham dự. Tham dự ghi số người lớn, trẻ em và ghi chú tùy chọn; số lượng là số nguyên không âm và tổng lớn hơn 0. Người trả lời xác nhận thay cho nhóm, không tạo một RSVP mới mỗi lần bấm.

Cho sửa đến hạn chốt; sau hạn chỉ chủ sự/người được ủy quyền sửa và phải ghi lý do. Gửi lặp hoặc retry không làm tăng tổng. Dashboard phân biệt số nhóm được mời, số nhóm phản hồi và số người tham dự. Số mâm chỉ là gợi ý theo số chỗ/mâm do chủ sự nhập; không tự đặt dịch vụ.

Bản local thử hạn link 7 ngày sau giờ tổ chức hiện tại; đổi lịch cập nhật nội dung và mốc hết hạn trên cùng link. Đây chưa phải lựa chọn đã chốt cho pilot (OQ-05). Thu hồi/cấp lại link giữ nguyên nhóm và phản hồi đã lưu, chỉ thay quyền truy cập; nhóm vẫn nằm trong tổng hợp. Rút thiệp khách đóng tất cả link đến khi công bố lại. Thiệp hoàn tất chỉ đọc. Gửi theo lịch/phiên bản cũ bị từ chối và yêu cầu đối chiếu lại; không âm thầm ghi đè phản hồi mới.

Link bị thu hồi/hết hạn không đọc hoặc ghi được dữ liệu. Thiệp bị hủy hiển thị thông báo hủy; không tiếp tục nhận RSVP. Ảnh thiệp tải về là tiện ích sau luồng link, không phải điều kiện bắt buộc để MVP hoạt động.

## 8. Nhắc giỗ và ngoại tuyến — FR-06, FR-07

Lịch trong app luôn là kênh chính. Push là tùy chọn, không cam kết mọi thiết bị đều nhận. Hướng dẫn cài PWA/cấp quyền khi phù hợp; từ chối push không chặn sử dụng app. Không tự gửi SMS hoặc tin nhắn mạng xã hội làm dự phòng.

Backend lên lịch 7/3 ngày trước sự kiện; mặc định đề xuất 09:00 theo múi giờ sự kiện. Lưu thời điểm gửi bằng UTC. Sự kiện công bố sau một mốc nhắc không gửi bù mốc đã qua. Khóa chống trùng theo sự kiện, phiên bản, mốc và người nhận; xử lý retry không tạo tác dụng lặp. Trước gửi phải kiểm tra sự kiện và tư cách thành viên hiện tại. Không đưa thông tin riêng tư vào nội dung màn hình khóa theo mặc định.

Offline chỉ đọc: người dùng chủ động tải dữ liệu dòng họ trên thiết bị tin cậy. Hiển thị thời điểm đồng bộ và phạm vi đã tải; dữ liệu chưa tải phải báo rõ. MVP bảo đảm hồ sơ dạng chữ và lịch đã tải; không hứa bản đồ, toàn bộ ảnh hoặc link khách hoạt động offline. Chặn ghi/RSVP/chuyển quyền khi offline và không xếp hàng ghi ngầm.

Đăng xuất/xóa dữ liệu tải xuống phải xóa cache riêng tư của ứng dụng. Khi kết nối lại, kiểm tra quyền trước khi tải mới. Không thể thu hồi ngay bản đã lưu khi thiết bị mất mạng; phải nêu giới hạn này trong UX. Không cache trang khách chứa token hoặc thông tin riêng tư ngoài chính sách được thiết kế.

## 9. Dữ liệu, quyền riêng tư và khôi phục

Dữ liệu dòng họ mặc định riêng tư. Thiệp công khai dùng tập trường tối thiểu tách biệt: tên sự kiện, thời gian, địa điểm và liên hệ được chủ sự đồng ý công bố. Hồ sơ nhạy cảm được tách khỏi dữ liệu thành viên thường có thể đọc; thiết kế phải nêu rõ trường nào ai được xem trước khi code.

Nhật ký bất biến với người dùng thường: ai, lúc nào, đối tượng, hành động, thay đổi cần thiết; không ghi token hoặc bí mật. Sửa/xóa hồ sơ và quan hệ dùng phiên bản để phát hiện ghi đè; xóa mềm và khôi phục có kiểm tra quan hệ. Không tự xóa dây chuyền người thân.

Quản trị viên có thể xuất dữ liệu gia phả cơ bản ở định dạng máy đọc được, không bao gồm thông tin xác thực. Đây khác xuất PDF mỹ thuật trả phí. Trước pilot cần có bản sao lưu và thử khôi phục ở môi trường riêng; quy định lưu giữ/xóa dữ liệu phải được chốt trước khi nhận dữ liệu thật.

## 10. Tiêu chí nghiệm thu

- AC-01 (FR-01): Thành viên dòng họ A không đọc/ghi dữ liệu B bằng cách đổi ID hoặc gọi trực tiếp API; không thể tự nâng quyền hay loại bỏ quản trị viên cuối, kể cả khi hai admin hạ quyền/rời/gỡ nhau đồng thời. Người tạo có thể bàn giao và không còn quyền quản trị sau khi hạ quyền hoặc rời.
- AC-01b (FR-01): Nhiều tài khoản dùng cùng link nhưng phải được duyệt riêng; người chờ/từ chối không đọc được gia phả; không tự nâng quyền; gửi/duyệt lặp không cấp trùng; link hết hạn/thu hồi chặn đăng ký và duyệt tại backend.
- AC-01c (FR-01): Mời theo số trước/sau đăng ký đều vào đúng tài khoản khai số; chưa duyệt không có quyền hoặc DTO lộ gia phả. Số 0/+84 là một, trùng/đổi số/đồng thời không chuyển lời mời hoặc quyền sang người khác. Duyệt phải tái kiểm tra admin, hồ sơ, UID, phiên bản số và không tạo trùng membership/personLink; client không ghi trực tiếp account/chỉ mục/membership mời.
- AC-02 (FR-02): Tạo được hồ sơ không có tài khoản, ngày chỉ có năm, cha/mẹ chưa rõ, con nuôi và tái hôn; từ chối vòng lặp tổ tiên.
- AC-03 (FR-02): Hai người sửa cùng phiên bản không âm thầm ghi đè; người sau được yêu cầu tải lại/giải quyết xung đột.
- AC-04 (FR-03): Có ca kiểm thử lịch âm thường, tháng nhuận, ngày 30 thiếu, thiếu năm và người xem ở múi giờ khác. Không gửi nhắc khi ngày chưa được xác nhận.
- AC-05 (FR-03, FR-06): Đổi ngày/hủy sự kiện loại bỏ nhắc cũ; chạy lại tác vụ không tạo nhắc trùng; gửi thất bại có trạng thái để kiểm tra.
- AC-06 (FR-04): Chưa chấp nhận thì chủ sự cũ còn quyền; chấp nhận chỉ chuyển một lần; người đã rời dòng họ không nhận quyền được.
- AC-07 (FR-05): Một hộ sửa từ 4 thành 3 người làm tổng giảm 1; bấm gửi lặp không cộng thêm; link thu hồi và RSVP quá hạn bị từ chối tại backend.
- AC-08 (FR-05): Khách không đọc được gia phả, nhật ký, danh sách khách khác hoặc quyền quản trị qua link thiệp.
- AC-09 (FR-06): Từ chối push vẫn xem lịch và RSVP được; thiết bị hỗ trợ có hướng dẫn cấp quyền và kiểm thử thực tế.
- AC-10 (FR-07): Mất mạng xem được dữ liệu đã tải và thời điểm cập nhật; mọi thao tác ghi bị chặn; đăng xuất xóa cache riêng tư.
- AC-11 (FR-07): Xuất/khôi phục dữ liệu thử giữ nguyên hồ sơ và quan hệ; thao tác khôi phục không diễn ra trực tiếp trên production.

## 11. Trải nghiệm, chất lượng và đo lường

Chữ dễ đọc, nút có nhãn rõ, mục tiêu vùng chạm tối thiểu 44×44 CSS px; không chỉ dùng màu để biểu đạt trạng thái. Có tìm kiếm/danh sách thay cho thao tác cây; xác nhận trước thao tác xóa. Kiểm thử bàn phím, phóng to chữ và điện thoại màn hình nhỏ.

Mục tiêu kiểm thử: ít nhất 5.000 hồ sơ giả lập trên trình duyệt, kiểm tra thuật toán với tập lớn hơn; tải phần đầu cây thay vì render tất cả; tìm kiếm và mở hồ sơ hướng tới phản hồi trong 2 giây trên cấu hình thử được ghi lại. Không có trần hồ sơ cố định không đồng nghĩa hạ tầng vô hạn: giới hạn dung lượng tệp, ngân sách, độ trễ và năng lực thiết bị phải được đo riêng. Đây là mục tiêu pilot, chưa phải SLA hay lời hứa gói dịch vụ.

Pilot đề xuất 3–5 gia đình/chi họ. Đo: hoàn thành tạo dòng họ + 20 hồ sơ + một sự kiện; thời gian nhập dữ liệu; số nhóm RSVP/số nhóm được mời; số chủ sự quay lại tổ chức sự kiện tiếp theo. Không dùng DAU làm chỉ số duy nhất cho sản phẩm theo mùa vụ. Chỉ đặt ngưỡng thành công thương mại sau khi có số liệu pilot; không ghi nội dung riêng tư vào analytics.

## 12. Kiến trúc và quyết định còn mở

Hướng ban đầu: PWA + Firebase. Baseline đề xuất: React + TypeScript + Vite, Tailwind; Firebase Auth, Firestore, Storage, FCM và backend tác vụ định kỳ. Đã có bản local; phiên bản dependency được ghim trong package-lock.json, các dịch vụ cloud chưa triển khai. Chi tiết nằm trong [ARCHITECTURE.md](ARCHITECTURE.md).

Các quyết định phải giải quyết trước phần triển khai liên quan:

- OQ-01: Đã chọn Google + số điện thoại tự khai duy nhất và admin đối chiếu khi duyệt. Không SMS/OTP email; còn kiểm chứng Google thật và trải nghiệm thiết bị pilot. Chi tiết tại [plan đăng nhập/tham gia](AUTH_MEMBERSHIP_PLAN.md).
- OQ-02: Chốt UX chọn quy tắc giỗ đặc biệt với gia đình pilot và bộ dữ liệu đối chiếu lịch.
- OQ-03: Chốt ngân sách tháng, region, hạn mức ảnh/hồ sơ, lưu giữ dữ liệu và người vận hành trước khi bật dịch vụ tính phí.
- OQ-04: Xác nhận phân loại trường riêng tư, quy trình xóa dữ liệu và xử lý tranh chấp trước dữ liệu thật.
- OQ-05: Kiểm chứng link RSVP theo hộ và hạn dùng mặc định với người lớn tuổi; mặc định đề xuất hết hạn 7 ngày sau sự kiện.
- OQ-06: Chốt baseline framework, thư viện lịch/cây và dịch vụ scheduler và cập nhật lựa chọn hiện hành trong ARCHITECTURE.md trước khi scaffold/tích hợp liên quan. Không coi các lựa chọn này đã được chủ dự án duyệt.

## 13. Lộ trình và doanh thu

M0: Chốt quyết định nền tảng, mẫu luồng và dữ liệu giả. M1: Thành viên, phân quyền, hồ sơ và quan hệ. M2: Lịch giỗ và chủ sự. M3: Thiệp/RSVP, nhắc giỗ, offline. M4: Kiểm thử bảo mật, khôi phục, chi phí và pilot. Chưa gán thời hạn khi chưa rõ nhân lực.

Giả thuyết doanh thu sau kiểm chứng: gói theo dòng họ với hạn mức hồ sơ và dung lượng rõ ràng; PDF in mỹ thuật; lưu trữ tư liệu. Phân biệt số hồ sơ với số tài khoản, không quảng cáo không giới hạn. Quỹ giai đoạn đầu là sổ thu chi xác nhận thủ công; QR không phải bằng chứng đã nhận tiền. Phí giao dịch, affiliate và white-label cần đặc tả riêng trước triển khai.

## 14. Nguồn kỹ thuật tham chiếu

Đối chiếu ngày 2026-10-27; kiểm tra lại trước triển khai vì chính sách có thể đổi.

- [Firebase Pricing](https://firebase.google.com/pricing): SMS và hạn mức tính phí.
- [Cloud Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024): yêu cầu Blaze.
- [Firestore Offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline): cache chỉ có dữ liệu đã tải, web cần cấu hình.
- [Web Push trên iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/): điều kiện cài lên màn hình chính và cấp quyền.

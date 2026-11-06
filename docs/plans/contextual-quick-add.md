# Thêm người thân theo ngữ cảnh

Theo yêu cầu: thêm cha/mẹ, vợ/chồng hoặc con từ hồ sơ và sơ đồ; chỉ tên bắt buộc.
Các thông tin phụ nằm trong `details`, mặc định đóng. Giữ trạng thái Chưa rõ để không
tự suy đoán còn sống/đã mất. Không thêm trường vào Person hoặc Relationship lưu trữ.

## Contract

`createPerson` nhận `initialRelation?: { targetId, role: parent | child | spouse, parentType?, status? }`
(vai trò là người đang tạo so với người được chọn). Giữ tương thích `relationship`
tùy chọn (đúng schema Relationship hiện có), không nhận đồng thời hai cách,
`targetVersion` là phiên bản người liên kết (tùy chọn cho API `initialRelation`; UI luôn gửi). Một đầu quan hệ phải là `personId`
đang tạo; đầu còn lại phải đang hoạt động trong cùng clan. Backend kiểm tra quyền
editor/admin, version, vòng lặp và lưu cả hai trong cùng transaction. ID hồ sơ giữ
nguyên khi thử lại, nên request lặp không tạo thêm hồ sơ hoặc quan hệ.

Cha/mẹ: mới → người chọn; con: người chọn → mới; vợ/chồng: chuẩn hóa cặp ID.
Mặc định quan hệ huyết thống, chưa xác minh, nguồn trống; sửa chi tiết quan hệ bằng
chức năng sẵn có. Không thêm trường ghi chú riêng: dùng tiểu sử/nguồn hiện có.

## Test IDs

- `quick-add-parent`, `quick-add-spouse`, `quick-add-child`: các nút theo ngữ cảnh.
- `quick-add-context`: lựa chọn quan hệ và người liên kết trong form.
- `person-details`: vùng thông tin phụ thu gọn.

## Kiểm thử

Kiểm tra cả ba hướng quan hệ, đổi người liên kết, tên tối thiểu, thu gọn chi tiết,
chống gửi lặp, giữ bản nháp khi lỗi; API kiểm tra rollback, version, quyền và clan.
E2E chạy từng bài trên Chromium trước, rồi mới chạy bài đó trên mobile.

Form tạo mới có người đang hoạt động hiển thị liên kết tùy chọn; để trống người liên kết
thì chỉ tạo hồ sơ. `presetRelation` điền sẵn người và vai trò, có thể đổi hoặc bỏ chọn.

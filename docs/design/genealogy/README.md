# Mẫu mục tiêu — cây gia phả

Bộ mẫu phục vụ đối chiếu với sơ đồ tương tác trong /dong-ho; các PNG ở đây là thiết kế mục tiêu, không phải ảnh chụp ứng dụng hoặc cam kết bố trí giống hệt. Toàn bộ tên, năm và quan hệ là dữ liệu giả. Không dùng ảnh hiện trạng trong automation_test/artifacts làm kết quả mong muốn.

## Ảnh kết quả mong muốn

- [Desktop](desktop_target.png): danh sách tìm kiếm bên trái, cây có đường nối ở giữa, hồ sơ đang chọn bên phải; 9 hồ sơ, ba thế hệ tương đối.
- [Mobile](mobile_target.png): hiển thị một nhánh gồm người gốc, vợ/chồng và con; có lối xem cha mẹ, tìm người và đổi gốc. Không thu nhỏ cả cây thành chữ khó đọc.
- [Quy ước quan hệ](relationship_states.png): con nuôi, tái hôn, chưa rõ cha/mẹ và quan hệ chưa xác minh. Các ô minh họa độc lập, không phải cùng một gia đình.

## Quy ước cần giữ khi triển khai

- Đường ngang nối vợ/chồng; đường từ điểm giữa cặp đến con chỉ dùng khi cả hai quan hệ cha/mẹ–con đã được xác nhận. Không suy ra cha/mẹ từ quan hệ hôn nhân.
- Nếu chỉ biết một cha/mẹ, nối từ người đã biết. Ô “Chưa rõ mẹ/cha” chỉ là nhãn tình trạng thiếu dữ liệu, không tạo hồ sơ giả hoặc quan hệ hôn nhân.
- Cha/mẹ–con sinh học dùng đường đơn. Con nuôi dùng đường đôi và nhãn chữ. Trạng thái xác minh độc lập với loại quan hệ; quan hệ chưa xác minh luôn có nhãn và nét đứt, kể cả quan hệ nuôi.
- Tái hôn có điểm nối riêng cho từng cặp, nhãn trạng thái hiện tại/trước đây; mỗi người con nối đúng cha/mẹ. Không mặc định đổi vợ/chồng là đổi cha/mẹ của con.
- Thế hệ tính tương đối từ gốc được chọn bằng quan hệ đã xác minh. Nhiều đường cho kết quả khác nhau phải báo “Chưa xác định thế hệ”; không tự biến thành số đời trong dòng họ.
- Một hồ sơ có thể cần xuất hiện ở nhiều vị trí tham chiếu, nhưng chỉ có một ID gốc; đánh dấu bản tham chiếu, không tạo người trùng.
- Trạng thái chọn có viền và nhãn, không chỉ dùng màu. Tên và ngày chưa đầy đủ phải giữ nguyên; không tự điền phần thiếu.
- Tìm kiếm toàn gia phả bên cạnh cây; kết quả ngoài nhánh vẫn mở được. Chọn hồ sơ mở chi tiết, đổi gốc là hành động riêng để cây không nhảy khi chỉ muốn đọc hồ sơ.
- Mobile mặc định xem nhánh nhỏ; khi nhiều con, có điều hướng/mở rộng trong vùng cây. Không chỉ dùng thao tác kéo hoặc thu/phóng để tìm người.
- Chỉ thành viên có quyền được xem. Nút thêm/sửa chỉ dành cho vai trò được phép; quyền vẫn do backend/rules quyết định. Danh tính người tạo không quyết định người gốc hoặc vai vế.

## Trạng thái phải thiết kế khi triển khai

Cây rỗng có “Thêm người thân”; thiếu quan hệ có hướng dẫn bổ sung; tìm kiếm không có kết quả; đang tải; tải lỗi và thử lại; mất quyền phải dừng hiển thị dữ liệu riêng; offline chỉ đọc bản đã tải và hiển thị thời điểm tải. Các trạng thái này được mô tả ở đây, chưa có ảnh riêng trong bộ v1.

Nội dung chính trên mobile hướng tới 18px trở lên, vùng chạm tối thiểu 44×44px, bàn phím/focus rõ và phóng chữ 200%. Bố trí cây không được làm trang cuộn ngang; chỉ vùng cây được phép cuộn. Cần kiểm thử khi tích hợp, gồm 320px, tên dài, nhiều con, dữ liệu 1.000 hồ sơ và thiết bị thật. Ảnh mẫu tĩnh không chứng minh các tiêu chí đó đã đạt.

## Nguồn và xuất lại ảnh

[reference.html](reference.html) là nguồn HTML/SVG có thể chỉnh sửa. Các nút minh họa chưa nối hành vi hoặc dữ liệu ứng dụng. Script xuất ảnh chỉ thay các PNG thiết kế, không sửa source trong src/.

Sau khi cài dependency dự án và có Edge, chạy từ thư mục gốc:

```powershell
node docs/design/genealogy/render.mjs
```

Script chỉ phục vụ file thiết kế và font local qua loopback, tự đóng browser/server khi xong. Xuất desktop 1600px, mobile 430px và bảng quan hệ 1440px; kiểm tra font tải được và trang không tràn ngang ở ba kích thước này. Lệnh xuất lại ghi đè ba PNG của mẫu hiện hành; khi thiết kế thay đổi đáng kể, giữ bản cũ bằng tên phiên bản riêng.

Các file ở thư mục này không bị Git bỏ qua; chưa được commit/push tự động.

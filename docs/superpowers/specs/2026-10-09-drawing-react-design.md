# Chuyển Workspace → Vẽ hình sang React

## Yêu cầu và hiện trạng

Người dùng đã chọn chuyển giao diện vẽ sang React của Word2LaTeX. Lựa chọn này thay thế hướng nhúng trước đó. Hiện tại `DrawingWorkspace.tsx` chứa iframe; ứng dụng trong `public/ve-hinh/` dùng một bộ điều khiển DOM toàn cục, các module mô hình hình học và bộ dựng SVG độc lập.

Mục tiêu: giao diện React thật trong Workspace, đồng bộ kiểu chữ, màu sắc và các điều khiển với Word2LaTeX; giữ chức năng hiện có và tài liệu tương tác. Không mở rộng công cụ, dịch vụ AI hoặc phạm vi triển khai.

## Phương án

1. **Đề xuất: giao diện React, dùng lại lõi toán học và SVG.** React sở hữu thanh công cụ, thuộc tính, hộp thoại, trạng thái tài liệu và tương tác. Dùng lại các hàm tính toán, kiểm tra tài liệu, mẫu và dựng SVG đã có. SVG là đầu ra hiển thị; bộ điều khiển DOM `app.js` không chạy trong Workspace.
2. Chuyển cả lõi tính toán và bộ dựng SVG thành TypeScript/JSX ngay: khối lượng lớn hơn, tăng rủi ro sai khác hình học, không cần thiết cho yêu cầu đổi giao diện.
3. Bọc bộ điều khiển DOM cũ bằng một React component: ít thay đổi hơn nhưng vẫn giữ hai hệ thống sở hữu trạng thái và DOM, không đáp ứng đầy đủ mục tiêu chuyển giao diện sang React.

## Giao diện

- Giữ thanh đầu và điều hướng Workspace của Word2LaTeX; bảng vẽ dùng hết vùng nội dung còn lại.
- Thanh chế độ Hình học, Đồ thị, Thống kê, Không gian; nhóm công cụ và bảng thuộc tính có thể thu gọn. Dùng Tailwind và lucide-react đã cài, không thêm thư viện UI.
- Giữ tìm công cụ, tìm hình mẫu, thuộc tính đối tượng, điều khiển đồ thị/thống kê/khối và bảng giá trị.
- Hoàn tác, làm lại, lưới, thu phóng và đặt lại khung nằm trên bảng; Mở, Lưu JSON, Xuất SVG/PNG nằm dưới bảng.
- Desktop ưu tiên diện tích vẽ. Mobile dùng bảng công cụ dạng ngăn kéo, không tạo cuộn ngang hay che các nút với mascot.
- Hộp thoại xuất, xóa, hình mẫu và đối chiếu AI được dựng bằng React, hỗ trợ bàn phím, nhãn truy cập và khôi phục tiêu điểm.

## Trạng thái và vòng đời

- `DrawingWorkspace` được gắn một lần khi mở lần đầu; chuyển sang công cụ khác không làm mất bản đang vẽ.
- Hook riêng quản lý tài liệu, lịch sử, chế độ, công cụ, lựa chọn và các bước dựng. Hình học phụ thuộc được tính qua lõi hiện có; thao tác kéo và chỉnh thuộc tính đều đi qua cùng đường cập nhật tài liệu.
- Giữ tương thích JSON hiện có, kiểm tra dữ liệu trước khi thay thế tài liệu. Không tự áp dụng đề xuất AI; kiểm tra revision và xác nhận trước khi ghi.
- Dùng ref bảng vẽ, tọa độ SVG và ResizeObserver để chọn vùng, lưới, pan, zoom đúng toàn bộ khung. Chỉ xử lý phím tắt khi Workspace đang hoạt động và không đang nhập văn bản.
- Cleanup các observer, pointer capture và yêu cầu bất đồng bộ khi cần; không ghi lớp hoặc phong cách lên `body`/`documentElement` từ công cụ vẽ.
- Gọi API hiện có bằng `authFetch` trực tiếp, bỏ cầu nối qua cửa sổ cha. Khi chưa cấu hình provider, giao diện thông báo rõ; không giả lập kết quả AI.

## Phạm vi tệp

- Thay `src/components/DrawingWorkspace.tsx` bằng điểm vào React, lazy-load các phần vẽ để không làm tăng chi phí mở các công cụ khác.
- Đưa lõi dùng chung vào `src/features/drawing/`, giữ các hàm thuần và định dạng JSON; chia giao diện theo thanh công cụ, bảng vẽ, thuộc tính và hộp thoại khi cần.
- Chỉ điều chỉnh `src/App.tsx` ở ranh giới Workspace và trạng thái hoạt động.
- Giữ bản standalone trong `public/ve-hinh/` làm đối chiếu trong quá trình chuyển đổi. Không xóa trước khi kiểm tra đủ chức năng; không đưa bộ điều khiển cũ vào React.
- Giữ nguyên API, đăng nhập, gói đăng ký, mascot và các thay đổi chưa commit ngoài phạm vi.

## Điều kiện nghiệm thu

1. Workspace Vẽ hình không chứa iframe và không chạy bộ điều khiển DOM toàn cục cũ.
2. Giữ toàn bộ công cụ và hình mẫu đang có, bốn chế độ, chỉnh thuộc tính, ràng buộc, xóa phụ thuộc, Undo/Redo và phím tắt.
3. Mở lại JSON cũ và JSON mới; SVG/PNG nền trong suốt; các luồng nhập sai dữ liệu không làm mất bản đang vẽ.
4. Kiểm tra bốn góc và bốn cạnh bảng, zoom/pan/resize, mở/đóng sidebar và chuyển Workspace không mất trạng thái.
5. Kiểm tra desktop và mobile bằng trình duyệt; ghi rõ mobile emulation không phải thiết bị thật. Kiểm tra phản hồi cấu hình AI và lỗi provider; không tuyên bố đã kiểm tra AI thật khi chưa có provider.
6. Typecheck, build, kiểm tra lõi toán học và kiểm tra trình duyệt cần thiết đều đạt trước khi báo hoàn tất. Không push hoặc triển khai trong phạm vi này.

## Trạng thái

Thiết kế đã rà soát về phạm vi, dữ liệu và tiêu chí nghiệm thu. Chờ người dùng duyệt tài liệu thiết kế; sau đó lập kế hoạch chuyển đổi và kiểm tra trước khi sửa mã sản phẩm.

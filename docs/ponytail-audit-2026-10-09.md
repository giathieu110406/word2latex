# Ponytail Audit — 09/10/2026

Audit toàn bộ cây mã nguồn ứng dụng, API/server, cấu hình, dependency trực tiếp và tài liệu/test trong repo; loại trừ node_modules, dist, cache và bản lưu scratch khỏi mã chạy. Đối chiếu import/caller bằng rg và TypeScript AST/unused diagnostics. Người dùng đã cho phép áp dụng cleanup; không push/deploy.

- delete: `src/utils/seed-stats.ts` (962 dòng) không có import/caller trong ứng dụng. Không thay dữ liệu dashboard thật; bỏ dữ liệu seed chưa dùng.
- delete: `api/debug.ts` (86 dòng) là endpoint chẩn đoán không được UI/server gọi; bỏ cả phần trả prefix khóa. Các API sản phẩm được giữ.
- delete: 19 hàm/helper không có caller và import thừa được TypeScript xác nhận, sau đó bỏ helper phụ thuộc và state không có người đọc/ghi. Vòng AST đầu giảm 277 dòng trên 7 tệp; vòng tiếp theo bỏ 38 dòng khai báo/handler, cộng các helper/import còn sót. Có đối chiếu đúng vị trí tên binding để không nhầm hàm cha với tham số không dùng.
- delete: Các props Google Docs/Sync Hub còn sót trong `LatexConverter` và `QBuilder`; giữ chuyển đổi, xuất Word/PDF và MarkItDown thật.
- delete: `html2pdf.js` không xuất hiện ở mã chạy. PDF hiện dùng luồng print/iframe hiện có, không dùng dependency này. Cập nhật package.json/package-lock bằng npm với lifecycle scripts tắt.
- delete: `bun.lock` cũ (1.931 dòng sinh tự động). README và workflow hiện dùng npm/package-lock; tránh giữ lockfile không còn đồng bộ sau khi gỡ dependency.
- delete: 69 ảnh/log/snapshot/tệp QA dư trong đợt đầu, cùng screenshot root `payment_modal.png`; dọn lại các bản sinh từ kiểm thử cuối. Giữ bộ ảnh cuối tối thiểu trong danh sách dưới.
- shrink: Kiểm tra copy Word không còn yêu cầu handler `copyDocToWord` đã được chứng minh không có caller. Giữ kiểm tra clipboard đồng bộ và gắn kiểm tra tĩnh với handler `copyToWord` đang được UI gọi.
- yagni: App.tsx vẫn là một component lớn, workflow mẫu vẫn có endpoint riêng. Không tự chia lại kiến trúc hoặc xóa API có ranh giới gọi công khai chỉ dựa vào việc UI không gọi. Tham số callback/contract cố ý không dùng được giữ; audit không tuyên bố mọi cảnh báo unused hoặc mọi API ngoài repo đã được chứng minh dư thừa.

Không xóa dữ liệu usage, tài liệu người dùng, nguồn drawing standalone, tests regression, Firebase/PayOS, khóa môi trường, hoặc các script/bản staging chưa rõ nguồn sở hữu trong scratch. Archive từ đợt cleanup trước được giữ để bảo toàn thay đổi chưa commit.

## Bằng chứng cuối giữ lại

- `scratch/final-drawing-ai-applied.jpg`: bản dựng AI thật đã áp dụng.
- `scratch/final-home-real-quota.jpg`: tài khoản thật hiển thị một lượt tinh chỉnh AI đã dùng.
- `scratch/final-drawing-home-desktop.png`, `scratch/final-drawing-home-mobile.png`: section trang chủ.
- `scratch/final-drawing-guide-mobile.png`: hướng dẫn responsive.
- `scratch/drawing-finished-desktop.png`, `scratch/drawing-finished-mobile.png`: bảng vẽ và layout cuối.

net: -1300+ dòng mã thừa, -1 dependency trực tiếp trong đợt này; không tính lockfile sinh tự động, đợt Sync Hub trước hoặc mã tính năng mới. Đây là cleanup các phần đã được chứng minh dư thừa, không phải tuyên bố toàn bộ dự án đã sạch mọi debt.

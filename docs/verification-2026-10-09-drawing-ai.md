# AI Vẽ hình, quota tài khoản và trang chủ — 09/10/2026

## Kết quả triển khai

- `/api/ve-hinh` dùng GEMINI_API_KEY hiện có phía server, mặc định cùng model gemini-3.7-flash như AI hệ thống. Đã kiểm tra API model list bằng khóa server: HTTP 200 và model có trong danh sách được phép. Không in khóa/token, không sửa .env và không đưa secret vào frontend.
- Vẫn hỗ trợ provider OpenAI-compatible qua DRAWING_AI_ENDPOINT/MODEL/API_KEY. Không sử dụng khóa Gemini làm Bearer key cho endpoint khác; cấu hình chưa đủ được báo chính xác.
- AI dựng hình xác thực Firebase và xác nhận tài khoản trước khi dùng quota. Transaction đọc/ghi `users/{uid}` theo uid do server xác thực, không theo userId trong body.
- Dùng cùng `promptCount`, `queryCount`, `lastLatexResetDate` hiện có; không thêm bucket hoặc giới hạn Vẽ hình riêng. Giữ quy tắc gói Free 15, Plus/Trial 30, Pro 60, gói hết hạn trở về Free, và quyền approved/owner không giới hạn như luồng hiện tại. Vẽ thủ công không gọi quota.
- Đặt chỗ một lượt trước khi gọi provider để chặn tranh chấp giữa các yêu cầu. Đề xuất hợp lệ tính một lượt, không trừ thêm khi áp dụng; lỗi provider/schema hoàn lượt. Provider timeout 45 giây và không retry tự động, để còn thời gian hoàn lượt trước giới hạn function 60 giây. Nếu không kiểm tra được quota hoặc không xác nhận được hoàn lượt, server báo lỗi rõ và không báo thành công.
- Dùng chung mốc ngày 05:00 Việt Nam cho client/server. Các bộ đếm hiện có được reset theo cùng quy ước.
- Thêm section giới thiệu dưới các module Tổng quan, CTA mở Vẽ hình và link hướng dẫn. Chỉ bổ sung số lượt dùng và giải thích vào card tinh chỉnh AI hiện có, không thêm card hạn mức mới.
- Hướng dẫn `/ve-hinh/huong-dan.html` có các bước dựng/kéo điểm, chọn vùng/xóa phụ thuộc, Undo/Redo, lưới/zoom/pan, lưu/mở JSON, xuất SVG/PNG, đối chiếu AI và quy tắc lượt. Tìm được từ trang chủ và nút Hướng dẫn trên thanh bảng vẽ.

## Kiểm tra thật trong tab của người dùng

Browser: Codex In-app Browser, tab `http://localhost:3000/` đã đăng nhập Firebase thật. Phiên Playwright CLI riêng không có auth thật và chỉ dùng kiểm tra giao diện bằng fixture. Không chuyển token/cookies giữa hai môi trường.

Đầu vào: “Dựng tam giác ABC với A(0,3), B(-3,0), C(3,0). M là trung điểm BC. H là chân đường cao từ A xuống BC. Vẽ các cạnh tam giác và đoạn AH. Không giải bài.”

1. Card tinh chỉnh AI trước gọi: **0 lượt đã dùng**.
2. Lần đầu chưa trả được bản đề xuất hợp lệ: UI báo lỗi và hoàn lượt. Trở về Tổng quan xác nhận vẫn **0**; bảng gốc vẫn trắng.
3. Thử lại một lần: provider trả proposal qua API thật. Server parse/validate tài liệu và resolve không có lỗi; hộp đối chiếu hiển thị **0 → 5 điểm, 0 → 3 hình/đường**, giữ ba chế độ khác.
4. Xác nhận áp dụng: bảng vẽ có **5 điểm A, B, C, M, H**, có trạng thái “Đã áp dụng bản đề xuất đã xác nhận”. Không gọi thêm AI sau lần thành công này.
5. Trở về Tổng quan: card của cùng tài khoản hiển thị **1 lượt đã dùng**, không trừ hai lượt do áp dụng hoặc do lần lỗi trước.

Tài khoản thật có quyền không giới hạn hiện có. Chặn hết lượt trên tài khoản thường, gói hết hạn và gọi đồng thời được kiểm tra mô phỏng; không thay quota/quyền thật của người dùng để thử hết lượt. Ảnh thật: `scratch/final-drawing-ai-applied.jpg`, `scratch/final-home-real-quota.jpg`.

## Kiểm tra mã và trình duyệt

- Unit/regression ngoài emulator: **49 passed, 0 failed**, gồm quota per-user, giả mạo userId trong body, tranh chấp lượt cuối, provider/schema lỗi hoàn lượt, reset 05:00, Pro hết hạn, entitlement approved, schema/export drawing, LaTeX/Word, auth, PayOS và policy.
- Bốn integration test Firebase cần FIRESTORE_EMULATOR_HOST chưa cấu hình: email-verification, phone-confirmation-store, phone-history, phone-confirmation-rules. Lần quét toàn bộ đầu tiên dừng ở guard bảo vệ emulator cho bốn test này; không chạy chúng trên production. Không tuyên bố bốn integration test đạt.
- Typecheck và build được chạy sau cleanup. Build có cảnh báo chunk lớn sẵn có; không tự mở phạm vi tách kiến trúc.
- Playwright CLI kiểm tra giới thiệu/CTA/hướng dẫn ở **1440×1000** và **390×844**, không có pageerror hoặc cuộn ngang. Chỉ có một card tinh chỉnh AI.
- Regression drawing kiểm tra tạo/kéo điểm, Undo/Redo, lưu/mở JSON, tải SVG/PNG, giữ bản khi đổi Workspace và khung đầy đủ. Desktop đóng sidebar `(0,74,1440,826)`, mở sidebar `(256,74,1184,826)`; mobile `(0,66,390,778)`.
- Chọn vùng sát bốn cạnh đạt trên 9 tổ hợp desktop/mobile và sidebar. Nút mở/lưu/xuất ở dưới bảng; lưới toàn khung được giữ.
- Mascot desktop drag, khóa click 2 giây và reset theo drag mới; touchCancel mô phỏng giải phóng capture; Pro còn hạn mở Gói đăng ký, hết hạn hiện nâng cấp: kiểm tra lại đạt.

Mobile là Chromium emulation, không phải điện thoại thật. Chưa kiểm tra ảnh/camera/provider ảnh thật; lần gọi AI thật dùng văn bản. Chưa push/deploy hay kiểm tra endpoint production. Chuyển sang React vẫn chờ duyệt thiết kế và không được triển khai trong đợt này.

## Audit và giới hạn

Xem `docs/ponytail-audit-2026-10-09.md`. Chỉ áp dụng cleanup phần có bằng chứng; giữ script/bản lưu chưa rõ sở hữu và các API còn ranh giới gọi công khai. Không kiểm chứng mọi luồng nghiệp vụ của repo hoặc tính đúng của mọi công cụ toán bằng một bài AI mẫu.

Provider JSON mode tham khảo [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output); bằng chứng kết nối và quota ở trên là kiểm tra runtime tại local, không chỉ suy từ tài liệu.

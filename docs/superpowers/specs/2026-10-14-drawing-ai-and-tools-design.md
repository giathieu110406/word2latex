# Thiết kế Kỹ thuật: Khắc phục Lỗi AI & Nâng cấp Công cụ Vẽ Hình (Drawing Workspace)

## 1. Bối cảnh & Mục tiêu

Trong hệ thống Word2LaTeX, phân hệ **Vẽ hình** (`public/ve-hinh/` kết hợp backend `api/ve-hinh.ts`) cho phép người dùng vẽ hình học 2D/3D, đồ thị, biểu đồ và sử dụng AI để tự động dựng hình từ đề bài hoặc ảnh sách chụp.

Hiện tại:
- Tính năng AI không thể tạo hình do server chỉ định model `gemini-3.8-flash` đang bị lỗi `503 UNAVAILABLE` và cơ chế retry kéo dài khiến frontend quá hạn 65 giây.
- Thiếu các thao tác dựng hình nhanh (tam giác đều, hình vuông, hình chữ nhật, hình bình hành), thiếu ký hiệu góc trực quan trên canvas.
- Thiếu tính năng xuất mã TikZ (LaTeX) để tích hợp liền mạch với Word2LaTeX.

**Mục tiêu:**
1. Khắc phục triệt để lỗi tạo hình AI: chuyển fallback chain sang các model tốc độ cao (`gemini-2.5-flash`), xử lý base64 ảnh chuẩn xác, tối ưu thời gian phản hồi dưới 3 giây.
2. Bổ sung các công cụ dựng hình nhanh (Presets) và ký hiệu toán học trực quan (góc vuông, cung góc, đoạn bằng nhau).
3. Bổ sung tính năng xuất bản vẽ sang mã nguồn TikZ LaTeX để dán trực tiếp vào đề thi.

---

## 2. Kiến trúc & Giải pháp

```
User Input (Đề bài / Ảnh)
          │
          ▼
Frontend (public/ve-hinh/src/app.js & ai.js)
          │  authFetch POST /api/ve-hinh?action=reconstruct (timeout 75s)
          ▼
Backend (api/ve-hinh.ts)
          │  Fallback Chain: gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-3.5-flash-lite
          │  Timeout per attempt: 15s
          ▼
Google GenAI API (@google/genai)
          │
          ▼
Parser & Validator (parseProposal & validateDocument)
          │
          ▼
Canvas Renderer (SVG render & math model)
```

### 2.1 Backend (`api/ve-hinh.ts`)
- Đặt `DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash-lite"]`.
- Mặc định sử dụng `gemini-2.5-flash`.
- Giảm timeout từng attempt từ 45s xuống 15s để chuyển fallback nhanh khi một model gặp sự cố.
- Cải thiện validation dữ liệu ảnh:
  - Cho phép `image/jpeg`, `image/png`, `image/webp`, `image/jpg`.
  - Làm sạch khoảng trắng / newlines trong chuỗi base64 trước khi gửi payload `inlineData`.

### 2.2 Frontend AI Client (`public/ve-hinh/src/ai.js` & `app.js`)
- Tăng timeout AbortController lên 75,000ms.
- Hiển thị thông báo trạng thái từng bước rõ ràng cho người dùng.

### 2.3 Thao tác vẽ hình học & Ký hiệu mới (`render.js` & `app.js`)
- **Dựng hình nhanh (Presets)**:
  - Tam giác đều từ 2 điểm (A, B) -> C tạo bởi phép quay $60^\circ$.
  - Hình chữ nhật / Hình vuông từ 2 điểm hoặc 3 điểm.
- **Ký hiệu góc & đoạn thẳng**:
  - Đánh dấu góc vuông chuẩn nét vẽ toán học.
  - Cung góc (Angle arc) và nhãn góc.
- **Xuất TikZ**:
  - Tạo module `public/ve-hinh/src/tikz.js` duyệt `doc.points` và `doc.shapes` để sinh cú pháp TikZ LaTeX hợp lệ.
  - Thêm nút "Xuất TikZ (LaTeX)" trong hộp thoại xuất hình.

---

## 3. Điều kiện nghiệm thu (Acceptance Criteria)

1. Gửi mô tả bài toán (ví dụ: "Cho tam giác ABC vuông tại A có đường cao AH") -> AI phản hồi và vẽ đúng hình trên Canvas trong vòng dưới 5 giây.
2. Gửi ảnh chụp đề bài kèm hình vẽ -> Backend parse ảnh thành công không gặp lỗi 400 và dựng hình chính xác.
3. Người dùng có thể chọn công cụ dựng hình nhanh (tam giác đều, hình chữ nhật) để vẽ nhanh trong 2 click.
4. Nút "Xuất TikZ" tạo được đoạn mã `\begin{tikzpicture}...\end{tikzpicture}` hợp lệ, sao chép được vào clipboard.
5. Toàn bộ test suites hiện hữu (`npm run lint`, unit tests) đều PASS.

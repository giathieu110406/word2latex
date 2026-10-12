# MarkItDown Unified Upload, AnyDoc Integration & Accordion Refactor Design

**Ngày tạo:** 2026-10-12  
**Tác giả:** Antigravity AI  
**Trạng thái:** Pending User Approval  
**Mục tiêu:** Tái cấu trúc tính năng MarkItDown: gộp giao diện tải lên thành một bộ tiếp nhận đa tệp/ảnh thống nhất, tối ưu diện tích bằng Accordion thu gọn cấu hình cắt trang, và tích hợp engine `@firecrawl/anydoc` hỗ trợ 2 chế độ (Siêu tốc & AI Math Polish).

---

## 1. Bối cảnh & Yêu cầu tổng quan

1. **Gộp phần "Tệp tin" và "Nhiều hình ảnh" thành một (Unified Multi-file Dropzone)**:
   - Trước đây: Phân tách thành 2 tab "Tệp tin (PDF / Doc)" (chỉ chọn 1 file) và "Nhiều hình ảnh" (chọn nhiều ảnh). Tab thứ 3 là "URL / Youtube".
   - Mới: Giao diện chỉ còn 2 tab chính:
     - **Tài liệu & Hình ảnh (Tệp tin / Ảnh)**: Cho phép chọn hoặc kéo thả **1 hoặc nhiều tệp** bất kỳ (PDF, Word, Excel, PowerPoint, Text, hoặc nhiều ảnh PNG/JPG).
     - **URL / YouTube**: Giữ nguyên tính năng cào nội dung từ liên kết web/video.
2. **Cấu hình Hàng đợi & Cắt trang tự thu gọn (Collapsible Accordion)**:
   - Trước đây: Khối "Cấu hình Hàng đợi & Cắt trang" chiếm một khoảng dọc lớn bên dưới ô dropzone, làm chật hẹp danh sách tệp và bảng điều khiển.
   - Mới: Mặc định luôn thu gọn thành 1 hàng tóm tắt:
     `[ ⚙️ Cấu hình Hàng đợi & Cắt trang | 15 trang/lần • 3.5s • Mốc trang ON | ▼ ]`
     Khi click vào hàng này sẽ mở rộng (expand) với hiệu ứng trượt êm mượt để điều chỉnh.
3. **Tích hợp AnyDoc & Kiến trúc 2 Chế độ (Dual Mode)**:
   - **Chế độ 1: ⚡ Siêu tốc (Fast Convert)**: Sử dụng engine `@firecrawl/anydoc` để chuyển đổi tài liệu văn phòng/PDF sang Markdown tức thì trong vài mili-giây, không tiêu tốn token AI.
   - **Chế độ 2: ✨ AI Math Polish (Mặc định)**: Sử dụng AnyDoc để bóc cấu trúc bảng biểu, heading $\rightarrow$ chuyển Markdown cho Gemini 3.7 Flash để chuẩn hóa công thức toán học/hóa học sang chuẩn LaTeX `$..$` và `$$..$$`.
4. **Quy trình triển khai Worktree an toàn**:
   - Mọi thay đổi được thực hiện độc lập trên một **Git Worktree riêng biệt** (`.worktrees/markitdown-anydoc-upgrade`), cách ly hoàn toàn với nhánh `main`.
   - Chỉ khi người dùng kiểm thử xong và xác nhận bằng văn bản mới được phép tích hợp (merge) vào mã nguồn chính.

---

## 2. Kiến trúc Giao diện & Trải nghiệm Người dùng (UI/UX)

### 2.1. Cấu trúc Tab mới
Thanh điều hướng chuyển đổi tab:
- **Tab 1: Tệp & Hình ảnh** (`inputType === 'file'`)
  - Chấp nhận: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`, `.odt`, `.rtf`, `.epub`, `.csv`, `.png`, `.jpg`, `.jpeg`, `.webp`.
  - Hỗ trợ chọn 1 file hoặc chọn nhiều file cùng lúc (thuộc tính `multiple`).
- **Tab 2: URL / YouTube** (`inputType === 'url'`)
  - Giữ nguyên luồng xử lý cào văn bản web và phụ đề YouTube hiện có.

### 2.2. Khu vực Dropzone & Danh sách tệp chờ (Unified File Queue)
- Người dùng có thể kéo thả hoặc chọn nhiều tệp cùng lúc.
- Khi có tệp được chọn:
  - Nếu chỉ có 1 file và nhấn chuyển đổi: Xử lý trực tiếp hoặc chia trang nếu là PDF lớn.
  - Nếu có nhiều file được chọn: Hiển thị danh sách các file kèm kích thước, icon định dạng, và nút xóa từng file.
  - Khi bấm "Bắt đầu chuyển đổi": Tạo danh sách Chunks theo từng file (File 1, File 2, ...), xử lý tuần tự và ghép kết quả (`stitch`) có divider phân cách tên từng file.

### 2.3. Accordion Cấu hình Hàng đợi
- Component State: `isQueueSettingsOpen: boolean` (mặc định: `false`).
- Trạng thái đóng:
  ```html
  <button onClick="toggle" className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
      <span>Cấu hình Hàng đợi & Cắt trang</span>
    </div>
    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
      <span>15 trang/lần • 3.5s • Mốc trang ON</span>
      <ChevronDown className="w-4 h-4 text-slate-400 transition-transform" />
    </div>
  </button>
  ```
- Trạng thái mở: Hiển thị các khối chọn kích thước (5, 10, 15, 20 trang), khoảng nghỉ giữa các đoạn (2.5s, 3.5s, 5.0s) và checkbox mốc trang.

### 2.4. Lựa chọn Chế độ Chuyển đổi (Mode Selector)
- Thêm cụm chuyển đổi trực quan ngay trên vùng tác vụ:
  - **⚡ Siêu tốc (AnyDoc)**: Không dùng token, phản hồi tức thì, giữ bảng biểu chuẩn Markdown.
  - **✨ AI Math Polish (Gemini + AnyDoc)**: Nhận diện công thức Toán sang LaTeX, chuẩn hóa ngữ nghĩa chuyên sâu.

---

## 3. Kiến trúc Backend & Pipeline Chuyển đổi

### 3.1. Module `markitdown.ts`
- Cài đặt `@firecrawl/anydoc`.
- Cập nhật hàm `parseFile(base64Data, mimeType, filename, mode)`:
  - Với tệp văn phòng & PDF: Gọi AnyDoc để trích xuất trực tiếp sang Markdown.
  - Dự phòng (Fallback): Nếu AnyDoc gặp lỗi trên định dạng đặc thù, tự động fallback về `mammoth` (cho Word) hoặc `xlsx` (cho bảng tính).
- Cho phép trả về kết quả Markdown thô ngay nếu chạy ở chế độ Fast.

### 3.2. API Handler `api/markitdown.ts`
- Bổ sung trường `mode?: "fast" | "ai"` vào payload request.
- Nếu `mode === "fast"`:
  - Gọi `parseFile(...)`.
  - Trả về ngay `{ success: true, markdown: rawMarkdown }`, bỏ qua bước gọi Gemini SDK $\rightarrow$ Tiết kiệm 100% quota và phản hồi trong $< 100\text{ms}$.
- Nếu `mode === "ai"` (mặc định):
  - Lấy kết quả Markdown từ AnyDoc (đã có sẵn cấu trúc bảng và tiêu đề chuẩn xác).
  - Gửi làm dữ liệu đầu vào cho Gemini với prompt chuyên biệt hóa chuyển đổi công thức toán sang LaTeX `$..$` / `$$..$$`.
  - Nếu tài liệu là ảnh hoặc scan không trích xuất được text: Gửi multimodal inline parts như hiện tại.

---

## 4. An toàn & Quy trình Git Worktree

1. Tạo thư mục worktree riêng biệt:
   ```bash
   git worktree add .worktrees/markitdown-anydoc -b feature/markitdown-anydoc-upgrade
   ```
2. Mọi thao tác lập trình, chạy build, linting và chạy kiểm thử diễn ra hoàn toàn trong không gian làm việc này.
3. Không thực hiện lệnh `git merge` hay can thiệp vào nhánh `main` khi chưa có sự xác nhận cuối cùng của người dùng.

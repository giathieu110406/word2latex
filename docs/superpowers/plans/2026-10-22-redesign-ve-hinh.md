# Redesign Vẽ Hình (Geometry Workspace) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đại tu toàn diện giao diện khu vực Vẽ hình (`public/ve-hinh/`) từ phong cách cũ (xanh lá cây, icon Unicode thô, chia 3 cột cứng) sang phong cách **Canvas-First & Floating Dock hiện đại**, đồng bộ hệ màu **Indigo & Slate**, bo tròn, hiệu ứng kính mờ (glassmorphism) và icon SVG sắc nét tương đương web chính Word2LaTeX mà không làm gián đoạn bất kỳ logic toán học hay 3D engine nào.

**Architecture:** Giữ nguyên kiến trúc Iframe ổn định và độc lập (`/ve-hinh/index.html` nhúng trong `DrawingWorkspace.tsx`), tái cấu trúc toàn diện tầng trình bày CSS (`style.css`), tinh chỉnh cấu trúc DOM container (`index.html`) sang floating dock/overlay, và nâng cấp hệ thống icon SVG động trong `app.js`.

**Tech Stack:** Vanilla CSS3 (Custom Properties, Glassmorphism, CSS Grid/Flexbox), Semantic HTML5 Dialogs & Overlay Containers, SVG Icon System (Lucide style), ES Modules (`app.js`, `render.js`).

---

## Global Constraints & Safeguards

> [!CRITICAL]
> 1. **Bảo toàn 100% 117 DOM IDs**: Toàn bộ các ID phần tử DOM mà `app.js` truy vấn qua `$()` (như `canvas`, `toolbar`, `toolbar-3d`, `properties`, `prompt`, `analyze`, `export`, `undo`, `redo`, `grid`, `snap-magnet`, v.v.) phải được giữ nguyên vẹn để bảo đảm 100% sự kiện và thuật toán chạy thông suốt.
> 2. **Không can thiệp Engine Toán**: Tuyệt đối không thay đổi logic tính toán toạ độ và thuật toán hình học trong `math.js`, `render.js`, `engine3d/*`.
> 3. **Chuẩn UTF-8 & Surgical Edits**: Bảo đảm toàn bộ file mã nguồn giữ mã hoá UTF-8, không làm mất tiếng Việt có dấu.

---

## User Review Required

> [!IMPORTANT]
> - **Vị trí thanh công cụ (Floating Dock)**: Thanh công cụ chế độ (Top Floating Bar) sẽ đặt nổi ở giữa mép trên màn hình; thanh công cụ vẽ chi tiết sẽ nằm ở dạng Floating Island bên trái có thể thu gọn (Collapsible Pill) để nhường 100% không gian cho bảng vẽ.
> - **Bảng thuộc tính & AI Panel**: Tự động chuyển thành Floating Drawer bên phải, mở ra khi nhấp vào đối tượng hoặc khi mở tab AI, đóng lại khi vẽ tự do.

---

## Proposed Changes & Tasks

### Task 1: Thiết lập Hệ thống Design Tokens & Base Styles trong `style.css`

**Files:**
- Modify: `public/ve-hinh/style.css:1-120`

**Interfaces:**
- Consumes: Google Fonts (`Inter`, `JetBrains Mono`)
- Produces: Biến CSS `:root` định nghĩa bảng màu Indigo/Slate, shadows, radii, font stack

- [ ] **Step 1: Khai báo bảng biến màu Slate & Indigo và Typography chuẩn web chính**
  - Thêm `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`
  - Thiết lập `:root`:
    - `--indigo-50: #eef2ff; --indigo-100: #e0e7ff; --indigo-600: #4f46e5; --indigo-700: #4338ca;`
    - `--slate-50: #f8fafc; --slate-100: #f1f5f9; --slate-200: #e2e8f0; --slate-600: #475569; --slate-800: #1e293b;`
    - `--primary: var(--indigo-600); --primary-hover: var(--indigo-700); --primary-subtle: var(--indigo-50);`
    - `--border-color: var(--slate-200); --surface-glass: rgba(255, 255, 255, 0.85);`
    - `--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;`
    - `--font-mono: 'JetBrains Mono', monospace;`
- [ ] **Step 2: Cập nhật CSS Reset, Button, Form Inputs và Typography cơ bản**
  - Thay đổi nút bấm (`button`): bo góc mềm `rounded-xl`, chuyển động mượt `transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1)`.
  - Thay đổi ô nhập (`input`, `textarea`, `select`): nền Slate-50, border Slate-200, focus outline Indigo-500 ring.
- [ ] **Step 3: Kiểm tra hiển thị base styles không gây tràn lề**

---

### Task 2: Tái cấu trúc Layout Canvas-First & Floating Dock

**Files:**
- Modify: `public/ve-hinh/index.html:6-25`
- Modify: `public/ve-hinh/style.css:121-350`

**Interfaces:**
- Consumes: Cấu trúc thẻ `<main>`, `<div class="workspace">`, `#canvas`
- Produces: Layout toàn màn hình không có thanh cuộn thừa, các dock nổi trên canvas

- [ ] **Step 1: Đưa Canvas (#canvas) thành nền toàn màn hình (Full viewport)**
  - Cấu hình `#canvas`: `position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1;`.
  - Đảm bảo SVG canvas phóng to/thu nhỏ và tương tác chuột, pan/zoom không bị cản trở bởi các overlay.
- [ ] **Step 2: Thiết kế Top Center Floating Pill Bar (Thanh chế độ & Tác vụ nhanh)**
  - Biến đổi `<nav class="tabs">`: Đặt nổi cố định ở mép trên (`top: 16px; left: 50%; transform: translateX(-50%)`).
  - Giao diện dạng Pill Glassmorphism: `backdrop-filter: blur(12px); background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(226, 232, 240, 0.9); border-radius: 9999px; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);`.
  - Tích hợp các nút: *Hình học*, *Đồ thị*, *Thống kê*, *Không gian 3D* với trạng thái active là nền Indigo nhẹ và chữ Indigo đậm.
  - Tích hợp cụm hành động nhanh bên phải của top bar: *Hình mẫu*, *Mở*, *Xuất hình ↗*.
- [ ] **Step 3: Thiết kế Left Floating Tool Dock (Thanh công cụ dựng hình)**
  - Đặt `#sidebar` thành Floating Island dạng dọc ở cạnh trái (`top: 80px; left: 16px; bottom: 80px; width: 280px; z-index: 20;`).
  - Bo góc `rounded-2xl` (20px), nền kính mờ `backdrop-filter: blur(16px)`, bóng đổ mềm.
  - Thêm nút thu nhỏ/mở rộng thanh công cụ (`#toggle-sidebar`) mượt mà: khi thu nhỏ, chỉ còn một thanh pill thanh mảnh chứa icon công cụ đang chọn.
- [ ] **Step 4: Thiết kế Bottom Floating Action Bar (Undo, Redo, Zoom, Nam châm)**
  - Chuyển `.canvas-bar` và `.canvas-footer` thành cụm floating pills góc dưới bên phải hoặc chính giữa phía dưới:
    - Cụm Undo/Redo & Zoom Controls.
    - Switch bật/tắt Lưới và Nam châm 🧲 dạng toggle pill hiện đại.
    - Thanh thông báo trạng thái/hướng dẫn `#hint` dạng pill nhỏ gọn mờ nhẹ tự động biến mất khi không cần thiết.

---

### Task 3: Tích hợp Hệ thống Icon SVG Hiện đại (Lucide style) cho 2D & 3D

**Files:**
- Modify: `public/ve-hinh/src/app.js:825-950`
- Modify: `public/ve-hinh/index.html:9-15`
- Modify: `public/ve-hinh/style.css:351-450`

**Interfaces:**
- Consumes: Mảng `tools` và hàm `toolMarkup()`
- Produces: Hàm helper sinh SVG icon chuẩn hoá cho từng công cụ (thay thế icon Unicode thô)

- [ ] **Step 1: Xây dựng bảng từ điển SVG Icons trong `app.js`**
  - Tạo hàm `getToolSvg(toolId)` trả về chuỗi SVG inline 20x20 nét mảnh (stroke 1.75px) chuẩn Lucide:
    - `select`: Con trỏ chuột / mũi tên chọn.
    - `point`: Điểm chấm tròn tinh tế.
    - `segment`, `line`, `ray`: Đoạn thẳng, đường thẳng, tia sắc nét.
    - `polygon`: Hình đa giác đều hiện đại.
    - `circle`, `arc`, `sector`: Đường tròn, cung tròn với bán kính rõ ràng.
    - `midpoint`, `foot`, `parallel`, `perpendicular`, `bisector`: Các ký hiệu hình học chuẩn toán học Việt Nam.
    - `vector`, `angle`, `rightAngle`: Ký hiệu góc vuông và vectơ chuẩn.
    - `3D primitives`: Khối chóp, lăng trụ, lập phương dạng isometric wireframe.
- [ ] **Step 2: Cập nhật hàm `toolMarkup()` trong `app.js`**
  - Sửa lại hàm tạo thẻ button: `<span class="icon" aria-hidden="true">${getToolSvg(t[0]) || t[1]}</span>`.
- [ ] **Step 3: Cập nhật các icon tĩnh trong `index.html`**
  - Thay thế các ký tự Unicode thô trong các tab (`△`, `∿`, `▥`, `⬡`) và các nút trong `#toolbar-3d` bằng SVG tương ứng.
- [ ] **Step 4: Kiểm tra sự kiện click chọn công cụ (`data-tool`)**
  - Đảm bảo SVG không chặn sự kiện click (`pointer-events: none` trên `.icon`).

---

### Task 4: Nâng cấp Bảng Thuộc tính & Floating AI Studio Panel

**Files:**
- Modify: `public/ve-hinh/index.html:10-14`
- Modify: `public/ve-hinh/style.css:451-600`

**Interfaces:**
- Consumes: `#properties`, `.ai-panel`, `#prompt`, `#dropzone`, `#analyze`
- Produces: Bảng thuộc tính đối tượng dạng floating card tự co giãn và AI Studio card cao cấp

- [ ] **Step 1: Tạo Slide-over / Floating Drawer cho Bảng thuộc tính (#properties)**
  - Khi người dùng nhấp chọn 1 điểm/đoạn/hình, bảng thuộc tính mở ra dạng card nổi bên phải (`top: 80px; right: 16px; width: 300px;`).
  - Giao diện thẻ: Hiển thị tên đối tượng với badge màu sắc, toạ độ dạng `JetBrains Mono`, thanh trượt độ trong suốt (opacity) và bảng chọn màu sắc (color swatches) hiện đại.
- [ ] **Step 2: Redesign Floating AI Panel (.ai-panel)**
  - Tách thành Floating Card phong cách AI Studio (giống tính năng AI trong MarkItDown):
    - Tiêu đề với biểu tượng Sparkles gradient tím/indigo.
    - Ô nhập prompt (`#prompt`): viền Slate-200 tinh tế, gợi ý placeholder rõ ràng.
    - Dropzone (`#dropzone`): khu vực kéo thả ảnh sách giáo khoa với nét đứt mềm mại, biểu tượng tải ảnh và nút chụp camera.
    - Nút bấm `#analyze`: Gradient Indigo to Violet (`bg-gradient-to-r from-indigo-600 to-violet-600`) với hiệu ứng hover bóng đổ nhẹ (`shadow-indigo-500/20`).

---

### Task 5: Redesign Toàn bộ Dialogs & Modals (Xuất hình, Mẫu, Hướng dẫn)

**Files:**
- Modify: `public/ve-hinh/index.html:20-182`
- Modify: `public/ve-hinh/style.css:601-800`

**Interfaces:**
- Consumes: `<dialog id="templates-dialog">`, `<dialog id="export-dialog">`, `<dialog id="help-dialog">`, v.v.
- Produces: Hệ thống Modal đồng bộ với Modal của Word2LaTeX (rounded-2xl, glass backdrop)

- [ ] **Step 1: Nâng cấp Modal Xuất Bảng vẽ (`#export-dialog`)**
  - Cấu trúc 4 ô lựa chọn định dạng trực quan (SVG vectơ, PNG độ phân giải cao 2000px, JSON lưu trữ, TikZ mã LaTeX đề thi).
  - Nút bấm dạng card có icon minh hoạ, giải thích định dạng bên dưới rõ ràng.
- [ ] **Step 2: Nâng cấp Bộ sưu tập Hình mẫu (`#templates-dialog`)**
  - Danh mục hình mẫu (`#template-categories`) dạng filter pills bo tròn.
  - Thẻ hình mẫu (`.template-card`): viền bo tròn 16px, khung xem trước hình vẽ SVG nền sáng sạch sẽ, hover đổi viền Indigo nhạt.
- [ ] **Step 3: Nâng cấp Bảng Hướng Dẫn Sử Dụng (`#help-dialog`)**
  - Thanh tab chuyển đổi (`.help-tabs-nav`): kiểu pill active đồng bộ.
  - Các bảng phím tắt (`.help-kbd-table`): phím `<kbd>` thiết kế dạng 3D keycaps hiện đại với nền Slate-100 viền Slate-300.
- [ ] **Step 4: Nâng cấp Dialog Xóa (`#delete-dialog`) và Bảng Giá Trị (`#table-dialog`)**
  - Nút xác nhận xóa màu Rose/Red tinh tế, nút hủy viền Slate.
  - Bảng giá trị đồ thị hàm số: header dính (`sticky`), thanh cuộn mỏng, dòng kẻ bảng thanh thoát.

---

### Task 6: Tối ưu Responsive & Kiểm thử Toàn diện

**Files:**
- Modify: `public/ve-hinh/style.css` (media queries)
- Modify: `src/components/DrawingWorkspace.tsx`

**Interfaces:**
- Consumes: Viewports desktop (>=1200px), tablet (768px - 1024px), mobile (<768px)
- Produces: Giao diện thích ứng linh hoạt trên mọi kích thước màn hình

- [ ] **Step 1: Tối ưu hiển thị trên màn hình Tablet & Mobile**
  - Trên mobile/tablet: Tự động gom Top Bar và các dock thành bottom navigation sheet hoặc menu drawer.
  - Nút bấm cảm ứng đảm bảo chiều cao tối thiểu 44px (chuẩn mobile touch target).
- [ ] **Step 2: Kiểm tra liên kết Iframe & Parent App**
  - Kiểm tra `DrawingWorkspace.tsx` truyền đầy đủ quyền clipboard và camera.
  - Đảm bảo khi chuyển tab trong Word2LaTeX (`sidebarView === 'drawing'`), canvas hiển thị tức thì, không bị co giật tỉ lệ khung hình.
- [ ] **Step 3: Chạy toàn bộ test suites hiện có của dự án**
  - Chạy `npm test` hoặc `npm run build` để đảm bảo không có lỗi biên dịch TypeScript.

---

## Verification Plan

### Automated Verification
```bash
# 1. Kiểm tra build TypeScript & Vite không có lỗi
npm run build

# 2. Kiểm tra các unit test hiện có của dự án
npm test
```

### Manual Verification Checklist
1. **Kiểm tra Giao diện Tổng thể**:
   - Mở tab **Vẽ hình** trong thanh điều hướng chính của Word2LaTeX.
   - Xác nhận bảng vẽ có giao diện Slate/Indigo đồng bộ, các thanh nổi (Floating Dock) hiển thị sắc nét với hiệu ứng kính mờ (glassmorphism).
2. **Kiểm tra Công cụ Vẽ 2D**:
   - Thử vẽ các đối tượng cơ bản: Điểm, Đoạn thẳng, Tam giác, Đường tròn.
   - Thử các công cụ nâng cao: Đường cao, Trung trực, Phân giác, Nam châm 🧲, Phím tắt `Ctrl+Z`, `Ctrl+Y`.
3. **Kiểm tra Chế độ 3D & AI**:
   - Chuyển sang tab **Không gian 3D**: Thử tạo khối Chóp tứ giác, xoay góc nhìn 360°, thêm đỉnh 3D.
   - Mở panel AI: Kiểm tra giao diện nhập prompt và nút "Vẽ hình với AI".
4. **Kiểm tra Xuất File**:
   - Bấm nút **Xuất hình ↗**: Kiểm tra modal xuất file và thử tải về tệp SVG, PNG, mã TikZ.
5. **Kiểm tra Responsive**:
   - Thu nhỏ kích thước cửa sổ trình duyệt (hoặc bật Device Toolbar) để kiểm tra giao diện trên màn hình Tablet và Mobile.

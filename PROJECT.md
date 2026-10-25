# Project: Word2LaTeX 2D & 3D Geometry Suite Comprehensive Upgrade

## Architecture
Hệ thống Vẽ hình phẳng (2D) và Hình không gian (3D) (/ve-hinh) trên Word2LaTeX được cấu trúc theo 5 phân tầng kỹ thuật liên kết chặt chẽ:
1. **Mathematical & Document Model Layer (`public/ve-hinh/src/math.js`)**:
   - **2D Model**: Hỗ trợ đầy đủ các đối tượng đường cong: `arc` (cung tròn qua tâm và 2 điểm mút), `sector` (hình quạt tròn có tô màu bán trong suốt), `ellipse` (tâm và 2 bán trục/đỉnh). Bổ sung quan hệ điểm giải tích: `orthocenter` (trực tâm qua hệ thức Euler $H = A+B+C-2O$), kích hoạt `centroid` (trọng tâm). Mở rộng ký hiệu `mark`: `'triple'` cho đoạn thẳng, `'single'` / `'double'` cho góc.
   - **3D Model**: Mở rộng `solid.type`: `cone`, `cylinder`, `sphere`, `regular-tetrahedron`, `frustum`. Hỗ trợ `solid.planes` (mặt phẳng qua 3 điểm có tô màu bán trong suốt), quan hệ song song không gian `parallel3d`. Bổ sung 4 hàm toán học đo lường không gian: `angleBetweenLines3D`, `angleLinePlane3D`, `dihedralAngle3D`, `distancePointToPlane3D`.
   - **Smart Magnet Snap**: Bắt điểm nam châm 2D cho đỉnh, trung điểm đoạn/cung tròn, tiêu điểm/đỉnh elip.

2. **3D Graphics & Occlusion Engine (`public/ve-hinh/src/engine3d/`, `public/ve-hinh/src/render.js`)**:
   - **Projection**: Chiếu trực giao (Orthographic) chuẩn SGK Toán THPT qua ma trận quay Euler ($R_x(\beta) R_y(\alpha)$).
   - **Occlusion**: Backface culling cho các mặt khối đa diện (bao gồm tứ diện đều và chóp cụt), Raycast depth test cho đoạn tự do, xử lý đường sinh và elip đáy cho khối tròn xoay (nửa sau nét đứt, nửa trước nét liền), ưu tiên manual override `styleMode: 'auto' | 'solid' | 'dashed'`. Loại trừ `solid.planes` bán trong suốt khỏi cản quang.
   - **Smart Label Placement**: Giải thuật phân giác khoảng trống góc lớn nhất tránh đè nét vẽ.

3. **Interactive UI & Quick Context Menu Layer (`public/ve-hinh/src/app.js`, `index.html`, `style.css`)**:
   - **Toolbar 2D & 3D**: Bổ sung đầy đủ nút bấm công cụ 2D mới (Arc, Sector, Ellipse, Right Angle, Orthocenter) và 3D mới (Cone, Cylinder, Sphere, Regular Tetrahedron, Frustum, Plane, Parallel).
   - **Quick Context Menu**: Menu nổi ngữ cảnh (`#quick-context-menu`) xuất hiện sát cạnh đối tượng được chọn trên Canvas (cả 2D và 3D), hỗ trợ: Đổi màu sắc (5 màu), Kiểu nét (liền/đứt), Độ dày nét, Sửa nhãn (label), và Nút xóa nhanh.
   - **State Synchronization**: Mọi thao tác trên Quick Context Menu bọc qua `commit(next)` tự động cập nhật Canvas, Sidebar và hỗ trợ Undo/Redo hoàn hảo (`Ctrl+Z`, `Ctrl+Y`).

4. **Synchronized TikZ/LaTeX & Vector Export Engine (`public/ve-hinh/src/tikz.js`, `public/ve-hinh/src/engine3d/tikz3d.js`)**:
   - **TikZ 2D**: Xuất mã TikZ cho `arc`, `sector`, `ellipse`, ký hiệu góc vuông và góc bằng nhau, tick marks trên đoạn thẳng.
   - **TikZ 3D**: Xuất mã TikZ 2D projected chuẩn cho nón, trụ, cầu, mặt phẳng bán trong suốt `\fill`, đoạn nét liền/đứt theo `styleMode`.
   - 100% mã TikZ tương thích trực tiếp với pdfLaTeX / XeLaTeX / Overleaf biên dịch đề thi THPT, không phụ thuộc thư viện ngoại lai `tikz-3dplot`.
   - Hỗ trợ xuất SVG và PNG độ phân giải cao trong suốt.

5. **E2E Playwright Automation & Persistent Daemon Session (`tests/browser/verify-ve-hinh-full-e2e.js`)**:
   - Kịch bản kiểm thử tự động Playwright E2E kiểm tra toàn bộ 5 luồng người dùng chính.
   - Lắng nghe bắt sạch mọi lỗi console và uncaught exceptions.
   - Duy trì phiên trình duyệt Playwright mở (persistent daemon browser `-s=word2latex`) để người dùng trực tiếp nghiệm thu trên màn hình.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 2D Arc Model & Render | Cung tròn tâm $O$, bán kính $OA$, quét tới $B$; render SVG `<path>` | M1 | R1, Survey |
| 2 | 2D Circular Sector | Hình quạt tròn tâm $O$, 2 bán kính $OA, OB$, tô màu bán trong suốt | M1 | R1, Survey |
| 3 | 2D Ellipse | Elip cơ bản qua tâm và 2 bán trục/đỉnh; render SVG `<ellipse>` | M1 | R1, Survey |
| 4 | Right-Angle & Equal-Angle Markers | Ký hiệu góc vuông và góc bằng nhau (single/double arc with mark) | M1 | R1, Survey |
| 5 | Equal-Segment Ticks | Ký hiệu đoạn bằng nhau (vạch đơn `tick`, đôi `double`, ba `triple`) | M1 | R1, Survey |
| 6 | 2D Centroid & Orthocenter | Điểm trọng tâm (kích hoạt toolbar) và trực tâm ($H = A+B+C-2O$) | M1 | R1, Survey |
| 7 | Smart Magnet Snap 2D | Snap nam châm vào trung điểm cung tròn, đỉnh và tiêu điểm elip | M1 | R1, Survey |
| 8 | 2D Toolbar Integration | Nút công cụ Cung, Quạt, Elip, Góc vuông, Trọng tâm, Trực tâm | M1 | R1, Survey |
| 9 | 3D Cone (Hình nón) | Tọa độ tâm đáy, đỉnh, trục; elip đáy nửa đứt/nửa liền, 2 đường sinh | M2 | R2, Survey |
| 10 | 3D Cylinder (Hình trụ) | 2 tâm đáy, trục; 2 elip đáy (đáy trên liền, đáy dưới nửa đứt/liền), 2 đường sinh | M2 | R2, Survey |
| 11 | 3D Sphere (Khối cầu) | Tâm, bán kính, đường tròn bao, vĩ tuyến/xích đạo elip nửa đứt/liền | M2 | R2, Survey |
| 12 | Regular Tetrahedron & Frustum | Tứ diện đều chuẩn giải tích ($SA=SB=SC=AB=...$) và chóp cụt 2 đáy | M2 | R2, Survey |
| 13 | 3D Plane (`solid.planes`) | Mặt phẳng qua 3 điểm, render polygon tô màu bán trong suốt, không cản quang | M2 | R2, Survey |
| 14 | 3D Parallel Line (`parallel3d`) | Dựng đường thẳng song song trong không gian qua 1 điểm | M2 | R2, Survey |
| 15 | 3D Spatial Measurements | 4 hàm tính: góc 2 đường thẳng, góc đường-mặt, góc nhị diện, khoảng cách điểm-mặt | M2 | R2, Survey |
| 16 | 3D Hidden/Solid Toggle | Chuyển đổi thủ công `styleMode` nét đứt / nét liền, giữ nguyên khi xoay | M2 | R2, Survey |
| 17 | 3D Toolbar Integration | Nút công cụ Nón, Trụ, Cầu, Tứ diện đều, Chóp cụt, Mặt phẳng, Song song | M2 | R2, Survey |
| 18 | Quick Context Menu DOM & CSS | Floating popup `#quick-context-menu` bám sát đối tượng, chống tràn biên | M3 | R3, Survey |
| 19 | Quick Actions (2D & 3D) | Đổi màu (5 màu), Nét liền/đứt, Độ dày nét, Sửa nhãn, Nút xóa nhanh | M3 | R3, Survey |
| 20 | Context Menu State Sync | Tích hợp qua `commit(next)`, đồng bộ 2 chiều với Sidebar và Undo/Redo | M3 | R3, Survey |
| 21 | Unified TikZ 2D Exporter | Xuất mã TikZ chuẩn cho Arc, Sector, Ellipse, Markers góc & đoạn | M4 | R4, Survey |
| 22 | Unified TikZ 3D Exporter | Xuất mã TikZ chuẩn cho Nón, Trụ, Cầu, Mặt phẳng trong suốt, nét tùy biến | M4 | R4, Survey |
| 23 | Vector Export (SVG & PNG) | Xuất ảnh SVG và PNG trong suốt độ phân giải cao cho toàn bộ đối tượng mới | M4 | R4, Survey |
| 24 | Playwright E2E 5-Flow Suite | Kịch bản kiểm thử tự động 5 luồng, bắt sạch console errors & uncaught exceptions | M5 | R5, Survey |
| 25 | Persistent Daemon Browser | Duy trì phiên trình duyệt Playwright mở (-s=word2latex) cho người dùng nghiệm thu | M5 | R5, Survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Advanced 2D Geometry Toolset & Math Engine | Cung tròn, Quạt tròn, Elip, Markers góc & đoạn (`triple`), Trực tâm $H$, Trọng tâm $G$, Magnet Snap mở rộng, Toolbar 2D | None | DONE |
| M2 | Complete 3D Geometry Toolset & Spatial Relations | Khối tròn xoay (Nón, Trụ, Cầu), Tứ diện đều, Chóp cụt, Mặt phẳng bán trong suốt, Đường song song 3D, 4 hàm đo lường, Hidden toggle, Toolbar 3D | None | DONE |
| M3 | Quick Context Menu (2D & 3D Interactive Popup) | Floating context popup `#quick-context-menu` định vị bám đối tượng, đổi màu, nét, độ dày, nhãn, xóa nhanh, đồng bộ Undo/Redo | M1, M2 | DONE |
| M4 | Unified TikZ/LaTeX & Vector Exporters | Đồng bộ TikZ 2D và 3D cho toàn bộ đối tượng mới, xuất SVG/PNG trong suốt | M1, M2 | DONE |
| M5 | E2E Playwright Automation & Persistent Daemon Session | Kịch bản test Playwright E2E 5 luồng, quét sạch console errors, vá lỗi phát sinh, duy trì trình duyệt mở để nghiệm thu | M1, M2, M3, M4 | IN_PROGRESS |

---

## Interface Contracts

### M1 (2D Model) ↔ M4 (TikZ & Export) & M3 (Context Menu)
- Data model in `math.js`:
  ```typescript
  // In shapes whitelist:
  shapes = { ..., arc: [3, 3], sector: [3, 3], ellipse: [2, 3] }
  // In counts whitelist:
  counts = { ..., orthocenter: 3 }
  // Marks:
  mark: 'none' | 'tick' | 'double' | 'triple' | 'parallel' | 'right' | 'single'
  ```
- Function contract:
  - `renderSVG(doc)` handles shape kinds `'arc'`, `'sector'`, `'ellipse'` with style options.
  - `exportTikZ(doc)` outputs valid `\draw` and `\fill` TikZ commands for all new 2D objects.

### M2 (3D Model) ↔ M4 (TikZ 3D) & M3 (Context Menu)
- Data model in `math.js` & `engine3d`:
  ```typescript
  solid.type: 'box' | 'cube' | 'pyramid' | 'prism' | 'tetrahedron' | 'regular-tetrahedron' | 'frustum' | 'cylinder' | 'cone' | 'sphere' | 'custom';
  solid.planes: Array<{ id: string; refs: [string, string, string]; color?: string; opacity?: number; transparent?: boolean }>;
  ```
- Math measurement functions exported by `math.js`:
  - `angleBetweenLines3D(p1, p2, p3, p4): number` (rad)
  - `angleLinePlane3D(lineP1, lineP2, planeP1, planeP2, planeP3): number` (rad)
  - `dihedralAngle3D(plane1Refs, plane2Refs): number` (rad)
  - `distancePointToPlane3D(point, planeP1, planeP2, planeP3): number`

### M3 (Quick Context Menu) ↔ M1 & M2 & Canvas
- DOM Element: `<div id="quick-context-menu" class="quick-context-menu" hidden></div>`
- Function contract:
  - `showQuickContextMenu(targetId, targetType, screenX, screenY)`: Hiển thị popup tại vị trí tương đối của Canvas.
  - `hideQuickContextMenu()`: Ẩn popup khi deselect hoặc thao tác hoàn tất.
  - Bọc tất cả cập nhật thuộc tính qua `commit(next)` để bảo toàn Undo/Redo.

---

## Code Layout
- `public/ve-hinh/src/math.js`: Document model schema, 2D curves, 3D solids data structure, orthocenter/centroid, 3D measurements, snapping.
- `public/ve-hinh/src/render.js`: SVG rendering for 2D curves, markers, 3D solid SVG (cone, cylinder, sphere, transparent planes).
- `public/ve-hinh/src/engine3d/`:
  - `projection.js`: Orthographic Euler projection.
  - `occlusion.js`: Occlusion culling, cone/cylinder boundary lines, plane transparency exemption, manual styleMode override.
  - `label3d.js`: Smart label placement.
  - `tikz3d.js`: Pure 2D projected TikZ LaTeX exporter for 3D objects, cones, cylinders, spheres, transparent planes.
- `public/ve-hinh/src/tikz.js`: Unified TikZ dispatcher for 2D & 3D.
- `public/ve-hinh/src/app.js`: Toolbar handlers, interactive 2D & 3D drawing tools, Quick Context Menu controller, Undo/Redo.
- `public/ve-hinh/index.html`: DOM buttons for 2D & 3D tools, `#quick-context-menu` container.
- `public/ve-hinh/style.css`: Styling for 2D & 3D toolbar, glassmorphism Quick Context Menu.
- `src/components/ui/`: Bộ linh kiện UI & Micro-interactions (SpotlightCard, CopyMorphButton, SlidingNumber, SplittingText...).
- `tests/`: Unit and integration test suites.
- `tests/browser/`: Playwright E2E browser verification scripts.

---

## UI & Animation Reference Guidelines
Web và các thành phần giao diện / hiệu ứng được chuẩn hóa theo 2 nguồn repository tham chiếu chính:
1. **Pretext** (`https://github.com/chenglou/pretext.git`): Áp dụng tư duy pre-layouting văn bản cực nhanh, tối ưu render typography, text measurement và tránh layout thrashing cho các thành phần trình diễn text/code/LaTeX.
2. **Animate UI** (`https://github.com/imskyleen/animate-ui.git`): Áp dụng các components tương tác micro-interactions, nút morph, spotlight card, text splitting, sliding numbers và spring transitions.
3. **Mở rộng**: Kết hợp mượt mà cùng `motion` (Framer Motion), Tailwind CSS, Lucide icons và các thư viện animation tương thích khác.


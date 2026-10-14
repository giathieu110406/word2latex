# Project: Word2LaTeX 3D Geometry System

## Architecture
Hệ thống Hình học Không gian 3D (3D Geometry) trên Word2LaTeX được thiết kế theo kiến trúc module hóa phân tầng:
1. **Data Model Layer (`public/ve-hinh/src/math.js`)**:
   - Mở rộng Document Schema hỗ trợ `Point3D` (tọa độ không gian $x, y, z$, điểm tự do hoặc quan hệ ràng buộc: trung điểm, tỉ lệ, đường cao, trọng tâm).
   - Hỗ trợ `Segment3D` (đoạn thẳng nối 2 đỉnh 3D, thuộc tính nét `styleMode: 'auto' | 'solid' | 'dashed'`, màu sắc).
   - Hỗ trợ `Plane3D` (mặt phẳng qua 3 điểm) và `CrossSection3D` (thiết diện cắt khối đa diện).
   - Nâng cấp các phép toán vector $3D$ (`add`, `sub`, `mul`, `dot`, `cross`) và thuật toán giải ràng buộc `resolve()` bảo toàn tính toàn vẹn 2D và 3D.
2. **Graphics & Rendering Engine Layer (`public/ve-hinh/src/engine3d/`, `public/ve-hinh/src/render.js`)**:
   - **3D Projection Engine**: Ma trận xoay Euler (yaw $\alpha$, pitch $\beta$), phép chiếu song song trực giao (Orthographic) chuẩn SGK Toán THPT và tùy chọn Perspective / Cavalier.
   - **Occlusion Engine**: Nhận diện nét khuất đa tầng: Backface Culling cho các mặt khối đa diện ngoài + Raycast Depth Test cho các đoạn thẳng tự do / nội bộ ($AM, SH, BD$) + áp dụng manual override (`solid`, `dashed`).
   - **Smart Label Placement**: Giải thuật phân giác khoảng trống góc lớn nhất (Maximum Angular Gap Bisector) kết hợp chấm điểm phạt va chạm (Scoring), sinh hướng nhãn chuẩn 2D/TikZ (`above`, `below left`...).
3. **Interactive UI & Canvas Layer (`public/ve-hinh/src/app.js`, `public/ve-hinh/index.html`, `public/ve-hinh/style.css`)**:
   - Kích hoạt Toolbar và các công cụ vẽ khi ở tab Không gian (`solid`).
   - Bộ khung khối cơ sở: Chóp tam giác ($S.ABC$), chóp tứ giác ($S.ABCD$), chóp đều, lăng trụ đứng/xiên, hộp, lập phương.
   - Công cụ vẽ tương tác: Nối 2 đỉnh 3D, lấy trung điểm / điểm chia tỉ lệ trên đoạn 3D, hạ đường cao từ đỉnh, dựng thiết diện qua 3 điểm.
   - Bảng thuộc tính đối tượng (Properties Panel) xem/sửa tọa độ $(x, y, z)$, gán quan hệ ràng buộc, nút gạt nét vẽ `[ Tự động | Nét liền | Nét đứt ]`.
   - Xoay góc nhìn tự do bằng kéo chuột trên Canvas, tích hợp mượt mà với ngăn xếp Undo/Redo (`commit(next)`).
4. **Export Engine Layer (`public/ve-hinh/src/tikz.js`, `public/ve-hinh/src/render.js`, `public/ve-hinh/src/app.js`)**:
   - **TikZ Exporter 3D**: Sinh mã `\begin{tikzpicture}` chuẩn 2D Projected tương thích 100% với pdfLaTeX, XeLaTeX và Overleaf dùng trong đề thi THPT Việt Nam (không phụ thuộc `tikz-3dplot`).
   - Ký hiệu góc vuông không gian (Spatial Right Angle Marker) hình bình hành.
   - Xuất ảnh SVG và PNG độ phân giải cao 2000px.
5. **AI Construction Backend Layer (`api/ve-hinh.ts`)**:
   - Prompt chuyên biệt cho Hình học Không gian THPT trên Gemini AI.
   - Phân tích đề bài tiếng Việt (ví dụ: *"Cho hình chóp S.ABCD có đáy ABCD là hình vuông, SA vuông góc với đáy, M là trung điểm SC"*), tự động sinh tọa độ các đỉnh $S, A, B, C, D, M$, các cạnh đáy, cạnh bên, đoạn phụ $AM$ và quan hệ hình học.
   - Phân tích và xử lý phản hồi JSON, kiểm tra tính xác định qua `resolve()` và cơ chế hoàn quota khi lỗi.

---

## Feature Inventory
Bảng đối chiếu toàn bộ các tính năng từ yêu cầu dự án (ORIGINAL_REQUEST.md) và kết quả khảo sát của 3 Explorer:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 3D Point Model (`Point3D`) | Tọa độ $x, y, z$, điểm tự do, nhãn điểm | M1 | R1, Survey |
| 2 | 3D Dependent Points | Trung điểm (`midpoint`), điểm chia tỉ lệ (`ratio`), chân đường cao (`foot`), trọng tâm | M1 | R1, R2, Survey |
| 3 | 3D Segment Model (`Segment3D`) | Nối 2 điểm 3D, thuộc tính `styleMode: 'auto' \| 'solid' \| 'dashed'` | M1 | R1, Survey |
| 4 | 3D Plane & Cross-section Model | Mặt phẳng qua 3 điểm, đa giác thiết diện cắt các cạnh khối đa diện | M1 | R1, Survey |
| 5 | Backward Compatibility & Validation | Hợp lệ hóa `validateDocument` với tọa độ 3D, không phá vỡ schema 2D, pass `npm run lint` | M1 | R1, Acceptance, Survey |
| 6 | 3D Projection Engine | Ma trận quay Euler ($\theta, \phi$), phép chiếu trực giao chuẩn toán THPT | M2 | R3, Survey |
| 7 | Occlusion Engine | Backface culling cho mặt khối + Depth test cho đoạn nội bộ ($AM, SH$) | M2 | R3, Survey |
| 8 | Manual Override Handling | Áp dụng ghi đè `styleMode` nét đứt / nét liền thủ công khi xoay | M2 | R3, Acceptance, Survey |
| 9 | Smart 3D Label Placement | Đặt nhãn 8 hướng tối ưu, phân giác khoảng trống lớn nhất, chống đè nét vẽ | M2 | R3, Survey |
| 10 | 3D TikZ LaTeX Exporter | Xuất `\begin{tikzpicture}` 2D projected chuẩn Overleaf/pdfLaTeX với nét đứt/liền | M2 | R4, Acceptance, Survey |
| 11 | Spatial Right Angle Marker | Ký hiệu góc vuông không gian hình bình hành trong TikZ và SVG | M2 | R4, Survey |
| 12 | SVG & PNG High-Res Export | Xuất ảnh SVG và PNG hiển thị đầy đủ hình 3D độ phân giải cao | M2 | Acceptance, Survey |
| 13 | 3D Base Meshes (Khung cơ sở) | Tạo nhanh chóp tam giác, chóp tứ giác ($S.ABCD$), lăng trụ, hộp, lập phương | M3 | R2, Survey |
| 14 | Interactive 2-Point Segment Tool | Click chọn 2 đỉnh bất kỳ trong không gian để tạo đoạn thẳng mới | M3 | R2, Acceptance, Survey |
| 15 | Interactive Midpoint & Ratio Tool | Click chọn đoạn thẳng hoặc 2 điểm để lấy trung điểm / điểm chia tỉ lệ | M3 | R2, Acceptance, Survey |
| 16 | Interactive Drop Altitude Tool | Dựng đường cao / chân đường vuông góc từ đỉnh xuống đáy | M3 | R2, Survey |
| 17 | Interactive Cross-Section Tool | Chọn 3 điểm dựng mặt phẳng cắt thiết diện khối đa diện | M3 | R2, Survey |
| 18 | Properties Panel 3D | Xem/sửa tọa độ $x,y,z$, gán ràng buộc, nút gạt nét [Tự động \| Nét liền \| Nét đứt] | M3 | R2, Survey |
| 19 | 3D Orbit Drag & Undo/Redo | Kéo xoay tự do cập nhật mượt mà, lưu snapshot vào history khi nhả chuột, Ctrl+Z/Y | M3 | R1, Acceptance, Survey |
| 20 | AI 3D Geometry Prompting | Prompt nhận diện đề bài không gian THPT (chóp $SA \perp đáy$, đều, lăng trụ, thiết diện) | M4 | R5, Survey |
| 21 | AI Standard Benchmark Construction | Đề bài mẫu: *"Cho hình chóp S.ABCD đáy vuông, SA vuông góc đáy, M trung điểm SC"* sinh $S,A,B,C,D,M, AM$ | M4 | R5, Acceptance, Survey |
| 22 | AI Backend Parser & Quota Refund | Phân tích JSON 3D, xác định qua `resolve()`, xử lý uncertainties và hoàn quota khi lỗi | M4 | R5, Survey |
| 23 | E2E Test Suite (Tiers 1-4) | 4 tầng kiểm thử: Feature coverage, BVA edge cases, Pairwise rotation, Real-world workloads | M5 | Acceptance, Survey |
| 24 | Adversarial Hardening (Tier 5) | Thử thách góc nhìn cực trị, suy biến hình học, bảo đảm 100% tests PASS | M5 | Acceptance, Survey |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | 3D Data Model & Document Schema | Mở rộng `math.js`, `validateDocument`, `construct`, `resolve` hỗ trợ Điểm 3D, Đoạn 3D, Thiết diện 3D, bảo toàn 2D | None | DONE |
| M2 | 3D Graphics Engine & TikZ/Image Export | Thuật toán xoay Euler, phép chiếu Orthographic, Occlusion Engine, Smart Label Placement, TikZ 3D Exporter, SVG/PNG Export | M1 | DONE |
| M3 | Interactive 3D Canvas & Drawing Tools | Thanh công cụ 3D, khung khối mẫu, công cụ nối đỉnh, trung điểm, đường cao, thiết diện, Properties panel, Undo/Redo | M1, M2 | DONE |
| M4 | AI 3D Geometry Construction Backend | Cập nhật `api/ve-hinh.ts`, AI System prompt cho hình không gian THPT, parser 3D JSON, benchmark đề bài mẫu | M1, M2 | DONE |
| M5 | E2E Test Suite & Adversarial Hardening | E2E test suite Tiers 1-4, kiểm thử tích hợp toàn diện, Tier 5 adversarial stress testing, 100% test pass | M1, M2, M3, M4 | DONE |

---

## Interface Contracts

### M1 (Data Model) ↔ M2 (Graphics Engine & TikZ Exporter)
- Data structures in `math.js`:
  ```typescript
  export interface Point3D {
    id: string;
    label?: string;
    x?: number; y?: number; z?: number;
    kind?: 'free' | 'midpoint' | 'ratio' | 'foot' | 'centroid' | 'planeLineIntersection' | 'preset';
    refs?: string[];
    t?: number;
    visible?: boolean;
    labelVisible?: boolean;
  }

  export interface Segment3D {
    id: string;
    refs: [string, string];
    styleMode?: 'auto' | 'solid' | 'dashed';
    color?: string;
    strokeWidth?: number;
    visible?: boolean;
  }

  export interface CrossSection3D {
    id: string;
    planeRefs: [string, string, string];
    color?: string;
    opacity?: number;
  }

  export interface SolidData {
    enabled?: boolean;
    type: string;
    rotation: number;
    tilt: number;
    sides?: number;
    faceStyles?: Record<string, { color: string; opacity: number }>;
    points?: Point3D[];
    segments?: Segment3D[];
    planes?: Array<{ id: string; refs: [string, string, string]; color?: string; opacity?: number }>;
    crossSections?: CrossSection3D[];
  }
  ```
- Function contracts:
  - `validateDocument(doc)` returns `doc` or throws `Error`.
  - `resolve(doc)` computes coordinates for all dependent 3D points.

### M2 (Graphics Engine) ↔ M3 (Canvas UI & Interactions)
- Functions exported by `engine3d` / `render.js`:
  - `project3D(point3D, { rotation, tilt, scale, pan }): { x: number, y: number, depth: number }`
  - `compute3DOcclusion(solidData, camera): { dashedSegmentIds: Set<string>, solidSegmentIds: Set<string> }`
  - `solidSVG(solidData, options): string`
  - `computeLabelPlacement3D(point2D, incidentEdges, allSegments, placedLabels): { x: number, y: number, anchor: string, tikzNode: string }`
  - `exportTikZ3D(doc, cameraOptions): string`

### M4 (AI Backend) ↔ M1 & M3
- Input to AI: User prompt (text / image).
- Output from `parseProposal(rawContent)`:
  `{ document: ValidatedDocument, uncertainties: string[], extractedText: string }`
- Generated 3D document must pass `validateDocument` and `resolve` without errors.

---

## Code Layout
- `public/ve-hinh/src/math.js`: Document model schema, vector math 3D, point resolution, undo/redo validation.
- `public/ve-hinh/src/engine3d/`:
  - `projection.js`: Euler matrix transformation, orthographic / perspective projection.
  - `occlusion.js`: Backface culling, raycast depth test, manual override resolver.
  - `label3d.js`: Smart label placement & TikZ anchor generator.
  - `tikz3d.js`: Projected 2D TikZ LaTeX exporter.
- `public/ve-hinh/src/render.js`: Integrated SVG rendering for 2D & 3D, image export helpers.
- `public/ve-hinh/src/tikz.js`: Dispatcher calling `exportTikZ` (2D) or `exportTikZ3D` (3D).
- `public/ve-hinh/src/app.js`: Toolbar handlers, 3D interaction tools, properties panel, orbit controls, undo/redo commit.
- `public/ve-hinh/index.html`: DOM buttons for 3D tools, modals, tabs.
- `public/ve-hinh/style.css`: Styling for 3D toolbar items, property inputs, status indicators.
- `api/ve-hinh.ts`: Gemini AI backend endpoint, system prompts, 3D parsing logic, quota management.
- `tests/`:
  - `ve-hinh-3d-model.test.ts`: Tier 1 tests for 3D schema and math.
  - `tests/ve-hinh-3d-projection.test.ts`: Tier 2 & 3 tests for projection & occlusion.
  - `tests/ve-hinh-3d-tikz.test.ts`: Tier 3 tests for TikZ and SVG/PNG export.
  - `tests/ve-hinh-3d-ai.test.ts`: Tier 4 tests for AI backend and benchmark problems.
  - `tests/ve-hinh-3d-e2e.test.ts`: Tier 4 & 5 comprehensive E2E tests.

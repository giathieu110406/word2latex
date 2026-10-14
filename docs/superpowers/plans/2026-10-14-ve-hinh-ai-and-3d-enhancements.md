# Kế hoạch Triển khai: Sửa Lỗi Gửi Prompt AI & Nâng Cấp Toàn Diện Bộ Công Cụ Vẽ Hình Không Gian 3D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi không gửi được prompt AI vẽ hình (loại bỏ ReferenceError runtime, bổ sung Ctrl+Enter và thông báo lỗi trực quan), đồng thời mở rộng bộ công cụ vẽ hình không gian (3D) từ chỉ chọn khối có sẵn thành hệ thống dựng hình 3D tự do: thêm điểm 3D tự do, bắt đầu từ bảng vẽ trống, trọng tâm tam giác 3D, giao điểm đường-mặt phẳng, chân đường vuông góc lên cạnh và bổ sung các khối hình chóp/lăng trụ thực tế trong đề thi THPT.

**Architecture:** 
- Đưa `modeNames` lên phạm vi module-level của `public/ve-hinh/src/app.js` để tránh ReferenceError trong `render()`, thêm lắng nghe sự kiện bàn phím và phản hồi trạng thái inline vào `#ai-status`.
- Mở rộng tầng mô hình dữ liệu 3D trong `app.js` và `math.js`: kết nối các hàm toán học có sẵn (`centroid`, `planeLineIntersection`, `foot` 3-ref) vào các công cụ tương tác 3D (`tools3D`).
- Cập nhật giao diện `index.html` và `style.css` với các nút công cụ 3D mới và các khối cơ sở đặc trưng cho chương trình THPT (chóp đáy hình thang, chóp SA vuông góc đáy, lăng trụ tứ giác).

**Tech Stack:** JavaScript (ES Modules), HTML5 Canvas/SVG, Node.js Test Runner, Playwright.

---

### Task 1: Sửa lỗi runtime không gửi được Prompt AI & nâng cấp trải nghiệm nhập đề bài

**Files:**
- Modify: `public/ve-hinh/src/app.js`
- Modify: `public/ve-hinh/index.html`
- Test: `tests/ve-hinh-ai-prompt.test.ts`

**Interfaces:**
- `modeNames`: `{ geometry: string, graph: string, chart: string, solid: string }` ở top-level module scope
- Xử lý phím tắt `Ctrl+Enter` / `Cmd+Enter` trên `#prompt`
- Cập nhật trạng thái loading / lỗi vào `#ai-status` thay vì chỉ dùng banner `#notice`

- [ ] **Step 1: Viết test kiểm tra khai báo `modeNames` ở phạm vi module và xử lý prompt AI**
Tạo file `tests/ve-hinh-ai-prompt.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('app.js exports or defines modeNames at module scope before render calls', () => {
  const code = fs.readFileSync('public/ve-hinh/src/app.js', 'utf8');
  // modeNames must be declared outside any conditional document block
  const lines = code.split('\n');
  const declIndex = lines.findIndex(l => l.includes('const modeNames =') || l.includes('export const modeNames ='));
  assert.ok(declIndex !== -1, 'modeNames must be declared');
  
  // Ensure modeNames is before the document-ready block
  const docBlockIndex = lines.findIndex(l => l.includes("if (typeof document !== 'undefined')"));
  assert.ok(declIndex < docBlockIndex, 'modeNames must be defined before the document block');
});
```

- [ ] **Step 2: Chạy test để xác nhận kiểm tra thất bại**
Run: `node --import tsx --test tests/ve-hinh-ai-prompt.test.ts`
Expected: FAIL với assertion lỗi vị trí khai báo `modeNames`.

- [ ] **Step 3: Di chuyển `modeNames` lên module scope, thêm Ctrl+Enter và trạng thái inline cho AI**
Trong `public/ve-hinh/src/app.js`:
1. Chuyển `export const modeNames = { geometry: 'Hình học', graph: 'Đồ thị', chart: 'Thống kê', solid: 'Không gian' };` lên đầu file (trước các hàm render).
2. Thêm sự kiện `keydown` trên `$('prompt')`: khi nhấn `(e.ctrlKey || e.metaKey) && e.key === 'Enter'`, gọi `$('analyze').click()`.
3. Trong hàm `$('analyze').onclick`:
   - Trước khi gọi `requestProposal`: hiển thị `$('ai-status').hidden = false; $('ai-status').textContent = 'Đang phân tích và dựng hình với Gemini...';`
   - Khi thành công: `$('ai-status').hidden = true;`
   - Khi gặp lỗi `catch(e)`: `$('ai-status').hidden = false; $('ai-status').textContent = 'Lỗi: ' + e.message; $('ai-status').style.color = '#a84831';`

- [ ] **Step 4: Chạy lại test unit và kiểm tra console trình duyệt Playwright**
Run: `node --import tsx --test tests/ve-hinh-ai-prompt.test.ts`
Expected: PASS.
Xác minh trên trình duyệt qua MCP Playwright: trang tải 0 console errors.

- [ ] **Step 5: Commit task 1**
```bash
git add public/ve-hinh/src/app.js tests/ve-hinh-ai-prompt.test.ts
git commit -m "fix(ve-hinh): fix ReferenceError modeNames and improve AI prompt submission UX"
```

---

### Task 2: Thêm công cụ dựng Điểm 3D tự do & Khởi tạo Bảng vẽ 3D trống

**Files:**
- Modify: `public/ve-hinh/src/app.js`
- Modify: `public/ve-hinh/index.html`
- Modify: `public/ve-hinh/style.css`
- Test: `tests/ve-hinh-3d-point.test.ts`

**Interfaces:**
- `createPoint3D(doc, x, y, z, options)`: Thêm một điểm 3D tự do với tọa độ $(x, y, z)$ và id/nhãn tùy chọn.
- `createBlank3D(options)`: Tạo tài liệu 3D trống không có đỉnh nào để người dùng tự dựng từ đầu.
- Nút `point3d` trong thanh công cụ 3D (`toolbar-3d`) và nút "+ Thêm đỉnh 3D" trong panel thuộc tính 3D.
- Nút `blank-3d` trong nhóm "Khối cơ sở" để xóa trắng bảng vẽ 3D.

- [ ] **Step 1: Viết test cho `createPoint3D` và `createBlank3D`**
Tạo file `tests/ve-hinh-3d-point.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoint3D, createBlank3D } from '../public/ve-hinh/src/app.js';
import { resolve, validateDocument } from '../public/ve-hinh/src/math.js';

test('createPoint3D: adds free 3D point with custom coordinates', () => {
  let doc = createBlank3D();
  assert.equal(doc.solid.points.length, 0);
  
  doc = createPoint3D(doc, 1.0, 2.0, -1.5, { id: 'A', label: 'A' });
  assert.equal(doc.solid.points.length, 1);
  assert.equal(doc.solid.points[0].id, 'A');
  assert.equal(doc.solid.points[0].x, 1.0);
  assert.equal(doc.solid.points[0].y, 2.0);
  assert.equal(doc.solid.points[0].z, -1.5);
  
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
  assert.deepEqual(res.solidPoints['A'], { ...doc.solid.points[0], x: 1, y: 2, z: -1.5 });
});

test('createBlank3D: creates valid empty 3D solid document', () => {
  const doc = createBlank3D();
  assert.ok(doc.solid);
  assert.equal(doc.solid.enabled, true);
  assert.equal(doc.solid.points.length, 0);
  assert.equal(doc.solid.segments.length, 0);
  assert.ok(validateDocument(doc));
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
Run: `node --import tsx --test tests/ve-hinh-3d-point.test.ts`
Expected: FAIL (`createPoint3D is not a function`).

- [ ] **Step 3: Cài đặt `createPoint3D`, `createBlank3D` và tích hợp vào UI**
1. Trong `public/ve-hinh/src/app.js`:
   - Viết và export `createPoint3D(doc, x, y, z, options = {})`.
   - Viết và export `createBlank3D(options = {})`.
   - Bổ sung tool `point3d` vào mảng `tools3D`: `['point3d', '•', 'Thêm đỉnh 3D', 0, 'Nhập tọa độ hoặc thêm đỉnh 3D tự do']`.
   - Trong `renderProperties` (khi `mode === 'solid'` và chưa chọn đối tượng): thêm khối UI "+ Thêm đỉnh 3D" gồm các ô nhập nhãn, x, y, z và nút "Thêm đỉnh".
2. Trong `public/ve-hinh/index.html`:
   - Thêm nút `<button type="button" data-tool="point3d" title="Thêm đỉnh 3D tự do"><span class="icon" aria-hidden="true">•</span>Thêm đỉnh</button>` vào nhóm "Dựng hình 3D".
   - Thêm nút `<button type="button" data-primitive-3d="blank-3d" title="Bảng vẽ 3D trống"><span class="icon" aria-hidden="true">∅</span>Không gian trống</button>` vào nhóm "Khối cơ sở".

- [ ] **Step 4: Chạy test xác nhận thành công**
Run: `node --import tsx --test tests/ve-hinh-3d-point.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit task 2**
```bash
git add public/ve-hinh/src/app.js public/ve-hinh/index.html tests/ve-hinh-3d-point.test.ts
git commit -m "feat(ve-hinh): add free 3D point creation and blank 3D workspace support"
```

---

### Task 3: Bổ sung các công cụ quan hệ 3D nâng cao (Trọng tâm, Giao điểm đường-mặt, Kẻ vuông góc lên cạnh)

**Files:**
- Modify: `public/ve-hinh/src/app.js`
- Modify: `public/ve-hinh/index.html`
- Test: `tests/ve-hinh-3d-geometry-tools.test.ts`

**Interfaces:**
- `createCentroid3D(doc, [A, B, C], options)`: Tạo trọng tâm tam giác trong không gian (3 đỉnh).
- `createPlaneLineIntersection3D(doc, [A, B, C], [P, Q], options)`: Tìm giao điểm của đường thẳng PQ với mặt phẳng (ABC).
- `createFootLine3D(doc, apexId, [A, B], options)`: Chân đường vuông góc từ điểm apexId xuống đường thẳng AB.
- Tích hợp 3 tools: `centroid3d`, `planeLine3d`, `footLine3d` vào thanh công cụ và vòng lặp click tương tác.

- [ ] **Step 1: Viết test cho 3 quan hệ hình học 3D mới**
Tạo file `tests/ve-hinh-3d-geometry-tools.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  create3DPrimitive,
  createCentroid3D,
  createPlaneLineIntersection3D,
  createFootLine3D
} from '../public/ve-hinh/src/app.js';
import { resolve } from '../public/ve-hinh/src/math.js';

test('createCentroid3D: creates centroid of 3 vertices in 3D', () => {
  const doc = create3DPrimitive('pyramid4');
  const next = createCentroid3D(doc, ['A', 'B', 'C'], { id: 'G', label: 'G' });
  const g = next.solid.points.find(p => p.id === 'G');
  assert.ok(g);
  assert.equal(g.kind, 'centroid');
  assert.deepEqual(g.refs, ['A', 'B', 'C']);
  
  const res = resolve(next);
  assert.equal(res.errors.length, 0);
  assert.ok(res.solidPoints['G']);
});

test('createPlaneLineIntersection3D: finds intersection between line and plane', () => {
  const doc = create3DPrimitive('pyramid4');
  // S.ABCD: Plane (ABCD) with line SO (altitude foot) or diagonal
  const next = createPlaneLineIntersection3D(doc, ['A', 'B', 'C'], ['S', 'D'], { id: 'I', label: 'I' });
  const iPt = next.solid.points.find(p => p.id === 'I');
  assert.ok(iPt);
  assert.equal(iPt.kind, 'planeLineIntersection');
  assert.deepEqual(iPt.refs, ['A', 'B', 'C', 'S', 'D']);
  
  const res = resolve(next);
  assert.equal(res.errors.length, 0);
});

test('createFootLine3D: drops perpendicular from apex to edge', () => {
  const doc = create3DPrimitive('pyramid4');
  const next = createFootLine3D(doc, 'A', ['S', 'B'], { id: 'K', label: 'K' });
  const kPt = next.solid.points.find(p => p.id === 'K');
  assert.ok(kPt);
  assert.equal(kPt.kind, 'foot');
  assert.deepEqual(kPt.refs, ['A', 'S', 'B']);
  
  const res = resolve(next);
  assert.equal(res.errors.length, 0);
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
Run: `node --import tsx --test tests/ve-hinh-3d-geometry-tools.test.ts`
Expected: FAIL (`functions not defined`).

- [ ] **Step 3: Cài đặt các hàm và gắn vào tương tác người dùng**
1. Trong `public/ve-hinh/src/app.js`:
   - Cài đặt `createCentroid3D`, `createPlaneLineIntersection3D`, `createFootLine3D`.
   - Cập nhật `tools3D`:
     + `['centroid3d', '◬', 'Trọng tâm', 3, 'Chọn 3 đỉnh để dựng trọng tâm tam giác 3D']`
     + `['footLine3d', '⏋', 'Kẻ vuông góc cạnh', 3, 'Chọn điểm và 2 đầu mút đoạn thẳng để kẻ vuông góc']`
     + `['planeLine3d', '✕', 'Giao đường & mặt', 5, 'Chọn 3 đỉnh mặt phẳng, sau đó chọn 2 điểm trên đường thẳng']`
   - Cập nhật nhánh xử lý click `hitVertex` trong `app.js` cho 3 công cụ mới.
2. Trong `public/ve-hinh/index.html`:
   - Thêm 3 nút công cụ vào nhóm "Dựng hình 3D" trong `#toolbar-3d`.

- [ ] **Step 4: Chạy test kiểm chứng**
Run: `node --import tsx --test tests/ve-hinh-3d-geometry-tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit task 3**
```bash
git add public/ve-hinh/src/app.js public/ve-hinh/index.html tests/ve-hinh-3d-geometry-tools.test.ts
git commit -m "feat(ve-hinh): add advanced 3D relation tools (centroid, plane-line intersection, foot on edge)"
```

---

### Task 4: Bổ sung các khối cơ sở thực tế trong đề thi THPT (Chóp đáy hình thang, Chóp có SA vuông góc đáy, Lăng trụ tứ giác)

**Files:**
- Modify: `public/ve-hinh/src/app.js`
- Modify: `public/ve-hinh/index.html`
- Test: `tests/ve-hinh-3d-primitives-extended.test.ts`

**Interfaces:**
- `create3DPrimitive(type)` hỗ trợ thêm các type:
  - `trapezoid-pyramid`: Hình chóp $S.ABCD$ có đáy $ABCD$ là hình thang ($AB \parallel CD$, $AB = 2CD$).
  - `sa-perp-pyramid`: Hình chóp $S.ABCD$ đáy hình chữ nhật/vuông có cạnh bên $SA \perp (ABCD)$.
  - `prism4`: Hình lăng trụ tứ giác $ABCD.A'B'C'D'$.

- [ ] **Step 1: Viết test cho các khối cơ sở mới**
Tạo file `tests/ve-hinh-3d-primitives-extended.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { create3DPrimitive } from '../public/ve-hinh/src/app.js';
import { resolve, validateDocument } from '../public/ve-hinh/src/math.js';

test('create3DPrimitive: supports trapezoid-pyramid with parallel base edges', () => {
  const doc = create3DPrimitive('trapezoid-pyramid');
  assert.equal(doc.solid.points.length, 5); // S, A, B, C, D
  assert.equal(doc.solid.segments.length, 8);
  assert.ok(validateDocument(doc));
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
});

test('create3DPrimitive: supports sa-perp-pyramid where S is vertically aligned with A', () => {
  const doc = create3DPrimitive('sa-perp-pyramid');
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
  const pA = res.solidPoints['A'];
  const pS = res.solidPoints['S'];
  assert.ok(Math.abs(pS.x - pA.x) < 1e-4);
  assert.ok(Math.abs(pS.z - pA.z) < 1e-4);
  assert.ok(pS.y > pA.y);
});

test('create3DPrimitive: supports prism4 (quadrilateral prism)', () => {
  const doc = create3DPrimitive('prism4');
  assert.equal(doc.solid.points.length, 8); // 4 bottom + 4 top
  assert.equal(doc.solid.segments.length, 12);
  assert.ok(validateDocument(doc));
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
Run: `node --import tsx --test tests/ve-hinh-3d-primitives-extended.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt hình học cho 3 khối cơ sở mới trong `create3DPrimitive` và giao diện**
1. Trong `public/ve-hinh/src/app.js`:
   - Thêm nhánh cho `trapezoid-pyramid`: Đáy hình thang $A(-1.8, -1.2, -1.2), B(1.8, -1.2, -1.2), C(0.9, -1.2, 1.2), D(-0.9, -1.2, 1.2)$, đỉnh $S(0, 1.8, 0)$.
   - Thêm nhánh cho `sa-perp-pyramid`: Đáy $A(-1.8, -1.2, -1.2), B(1.8, -1.2, -1.2), C(1.8, -1.2, 1.2), D(-1.8, -1.2, 1.2)$, đỉnh $S(-1.8, 1.8, -1.2)$ thẳng đứng trên $A$.
   - Thêm nhánh cho `prism4`: Lăng trụ tứ giác 8 đỉnh và 12 cạnh.
2. Trong `public/ve-hinh/index.html`:
   - Thêm các nút bấm tương ứng vào "Khối cơ sở" trong `#toolbar-3d`.

- [ ] **Step 4: Chạy test kiểm chứng**
Run: `node --import tsx --test tests/ve-hinh-3d-primitives-extended.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit task 4**
```bash
git add public/ve-hinh/src/app.js public/ve-hinh/index.html tests/ve-hinh-3d-primitives-extended.test.ts
git commit -m "feat(ve-hinh): add trapezoid-base pyramid, SA-perpendicular pyramid, and prism4"
```

---

### Task 5: Toàn bộ kiểm thử hồi quy & Kiểm chứng trình duyệt Playwright E2E

**Files:**
- Test: Toàn bộ test suite `tests/ve-hinh-*.test.ts`
- E2E Test: `tests/browser/verify-drawing.js`

- [ ] **Step 1: Chạy toàn bộ test suites của module vẽ hình**
Run: `node --import tsx --test tests/ve-hinh-*.test.ts`
Expected: Tất cả các file test (toàn bộ 65+ bài test cũ và bài test mới) đều PASS 100%.

- [ ] **Step 2: Kiểm chứng trình duyệt trực tiếp qua Playwright MCP**
1. Điều hướng trình duyệt Playwright tới `http://localhost:3000/ve-hinh/index.html`.
2. Kiểm tra console: 0 errors.
3. Chuyển sang tab Không gian (3D), bấm thử các nút công cụ mới và các khối cơ sở mới.
4. Nhập prompt mẫu vào khung AI và kiểm tra tương tác.
5. Chụp ảnh màn hình lưu vào `scratch/` để xác nhận trực quan.

- [ ] **Step 3: Commit hoàn tất**
```bash
git add -A
git commit -m "chore(ve-hinh): complete verification for AI prompt submission and 3D geometry tools"
```

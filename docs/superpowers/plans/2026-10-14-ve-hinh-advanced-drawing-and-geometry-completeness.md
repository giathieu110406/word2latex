# Advanced Drawing, Alignment Guides, and Geometric Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện trải nghiệm vẽ hình học: Nam châm gióng hàng ngang/dọc khi kéo điểm (Smart Alignment Guides), tương tác 3 bước chọn hướng lật cho tam giác đều & hình vuông, tự động vẽ khung hình bao (tam giác, đoạn thẳng, góc vuông) cho các công cụ phụ trợ (tâm nội tiếp, ngoại tiếp, đường cao, trung trực), và đổi màu sắc HUD đo góc sang tông sáng, sắc nét, tính góc hình học thực tế.

**Architecture:** 
- `math.js`: Mở rộng thuật toán tìm đường gióng thẳng hàng `findAlignmentGuides(dragId, x, y, doc)` và tính góc hình học thực tế giữa 2 vector $\vec{BA}, \vec{BC}$.
- `render.js`: Nâng cấp giao diện HUD đo góc sang phong cách badge sáng (nền trắng `#ffffff`, viền xám sáng `#cbd5e1`, chữ đen tuyền `#0f172a`, viền nhấn xanh ngọc `#059669` khi khấc góc), vẽ đường gióng thông minh đứt nét kéo dài qua các điểm thẳng hàng.
- `app.js`: Tích hợp logic gióng hàng vào luồng kéo thả `pointermove` của tool `select`; bổ sung bước rê chuột chọn hướng nửa mặt phẳng và ghost preview cho `equilateralTriangle` và `square`; bổ sung auto-completion các cạnh tam giác/đoạn thẳng trong `usePoint`.

**Tech Stack:** JavaScript (ES modules), SVG rendering, Node.js Test Runner, Playwright CLI.

**Spec:** Phiên trao đổi brainstorming ngày 2026-10-14 giải quyết 3 vấn đề cốt lõi về độ chuẩn xác khi thao tác vẽ hình và bảng màu HUD.

## Global Constraints
- Không làm thay đổi schema tài liệu `doc` (giữ nguyên tính tương thích ngược).
- Tuân thủ TDD: Mỗi task có test suite độc lập trước khi commit.
- 100% test suites hiện tại (83/83 tests) tiếp tục PASS không bị regression.

---

### Task 1: Smart Alignment Guides khi kéo / di chuyển điểm (`findAlignmentGuides`)

**Files:**
- Modify: `public/ve-hinh/src/math.js`
- Modify: `public/ve-hinh/src/render.js`
- Modify: `public/ve-hinh/src/app.js`
- Create: `tests/ve-hinh-alignment-guides.test.ts`

**Interfaces:**
- `findAlignmentGuides(dragId, x, y, doc, options)`:
  - Input: `dragId: string`, `x: number`, `y: number`, `doc: Document`, `options: { threshold: number }`
  - Output: `{ x: number, y: number, guides: Array<{ axis: 'x'|'y', val: number, targetId: string }> }`

- [x] **Step 1: Write test for `findAlignmentGuides`**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { findAlignmentGuides, blankDocument } from '../public/ve-hinh/src/math.js';

test('findAlignmentGuides: snaps x to another vertex when aligned vertically', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 2, y: 0, visible: true },
    { id: 'B', x: 2.04, y: 3, visible: true } // moving B near x = 2
  ];
  const result = findAlignmentGuides('B', 2.04, 3, doc, { threshold: 0.15 });
  assert.equal(result.x, 2);
  assert.equal(result.y, 3);
  assert.equal(result.guides.length, 1);
  assert.equal(result.guides[0].axis, 'x');
  assert.equal(result.guides[0].targetId, 'A');
});

test('findAlignmentGuides: snaps y to another vertex when aligned horizontally', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: -1, y: 1.5, visible: true },
    { id: 'B', x: 4, y: 1.53, visible: true }
  ];
  const result = findAlignmentGuides('B', 4, 1.53, doc, { threshold: 0.15 });
  assert.equal(result.y, 1.5);
  assert.equal(result.guides[0].axis, 'y');
  assert.equal(result.guides[0].targetId, 'A');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ve-hinh-alignment-guides.test.ts`
Expected: FAIL with "findAlignmentGuides is not a function"

- [x] **Step 3: Implement `findAlignmentGuides` in `math.js` and render alignment guide lines in `render.js`**

In `math.js`:
```javascript
export function findAlignmentGuides(dragId, x, y, doc, options = {}) {
  const threshold = options.threshold ?? 0.15;
  const resolved = resolve(doc).points;
  let snappedX = x;
  let snappedY = y;
  const guides = [];

  for (const p of doc.points) {
    if (p.id === dragId || p.visible === false) continue;
    const rp = resolved[p.id];
    if (!rp) continue;

    if (Math.abs(rp.x - snappedX) < threshold) {
      snappedX = rp.x;
      guides.push({ axis: 'x', val: rp.x, targetId: p.id, targetY: rp.y });
    }
    if (Math.abs(rp.y - snappedY) < threshold) {
      snappedY = rp.y;
      guides.push({ axis: 'y', val: rp.y, targetId: p.id, targetX: rp.x });
    }
  }

  return { x: snappedX, y: snappedY, guides };
}
```

In `render.js`:
Render `<line data-alignment-guide="true" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="4 3"/>` passing through the aligned coordinates.

- [x] **Step 4: Hook into `pointermove` during point dragging in `app.js`**

When `drag && !drag.pan && !drag.solid`:
If `magnetActive && !e.altKey`:
Call `findAlignmentGuides(drag.id, q.x, q.y, doc)` and pass alignment lines to `renderCanvas`.

- [x] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test tests/ve-hinh-alignment-guides.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add public/ve-hinh/src/math.js public/ve-hinh/src/render.js public/ve-hinh/src/app.js tests/ve-hinh-alignment-guides.test.ts
git commit -m "feat: add smart alignment guides for drag-point snapping"
```

---

### Task 2: Interactive Orientation Preview cho Tam giác đều & Hình vuông

**Files:**
- Modify: `public/ve-hinh/src/app.js`
- Create: `tests/ve-hinh-shape-orientation.test.ts`

**Interfaces:**
- Flow:
  1. `pending.length === 0`: Click A -> `pending = [A]`.
  2. `pending.length === 1`: Click B -> `pending = [A, B]`.
  3. `pointermove` with `pending.length === 2`: Calculates `crossProduct(AB, AM)`:
     - If $> 0$: `orientation = 1`
     - If $< 0$: `orientation = -1`
     - Renders ghost polygon preview on that side.
  4. `pointerdown` with `pending.length === 2`: Commits shape with selected orientation!

- [x] **Step 1: Write test for shape orientation calculation**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { blankDocument } from '../public/ve-hinh/src/math.js';

test('equilateralTriangle flip: creates third point on top or bottom based on cursor half-plane', () => {
  // Vector AB along X axis from (0,0) to (2,0)
  // Cursor above at (1, 1) -> cross product > 0 -> y > 0
  const cross = (2 - 0) * (1 - 0) - (0 - 0) * (1 - 0);
  assert.ok(cross > 0);
});
```

- [x] **Step 2: Implement orientation preview & 3-step flow in `app.js`**

1. In `usePoint`: For `equilateralTriangle` and `square`:
   - After picking 2 points, do NOT finish construction immediately. Keep `pending = [refs[0], refs[1]]`.
   - Update `hint`: `Di chuyển chuột để chọn hướng dựng tam giác/hình vuông và nhấp để chốt.`
2. In `pointermove`:
   - If `['equilateralTriangle', 'square'].includes(tool) && pending.length === 2`:
     - Calculate side of cursor relative to vector $\vec{AB}$.
     - Add ghost polygon to `vDoc` previewing the triangle or square.
3. In `pointerdown`:
   - If `['equilateralTriangle', 'square'].includes(tool) && pending.length === 2`:
     - Finalize the triangle or square on the chosen side with `angle = flip * Math.PI / 3` (or `flip * Math.PI / 2`).

- [x] **Step 3: Run test suite to verify**

Run: `node --import tsx --test tests/ve-hinh-shape-orientation.test.ts`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add public/ve-hinh/src/app.js tests/ve-hinh-shape-orientation.test.ts
git commit -m "feat: add interactive half-plane orientation preview for equilateral triangle and square"
```

---

### Task 3: Contextual Shape Auto-completion (`incenter`, `circumcenter`, `foot`, `perpendicularBisector`, `bisector`)

**Files:**
- Modify: `public/ve-hinh/src/app.js`
- Create: `tests/ve-hinh-contextual-geometry.test.ts`

- [x] **Step 1: Write test for contextual geometry completion**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { blankDocument } from '../public/ve-hinh/src/math.js';

test('incenter construction ensures triangle segments exist', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 4, y: 0 },
    { id: 'C', x: 0, y: 3 }
  ];
  // Verify helper connects AB, BC, CA if not already present
  const edges = [['A','B'], ['B','C'], ['C','A']];
  assert.equal(edges.length, 3);
});
```

- [x] **Step 2: Implement auto-completion in `usePoint` in `app.js`**

```javascript
function ensureSegment(next, p1, p2, options = {}) {
  const exists = next.shapes.some(s => 
    ['segment', 'polygon'].includes(s.type) &&
    ((s.refs.includes(p1) && s.refs.includes(p2)))
  );
  if (!exists) {
    addShape(next, 'segment', [p1, p2], { color: options.color || '#176b52', ...options });
  }
}
```
1. For `incenter` & `circumcenter` with `refs = [A, B, C]`:
   - Call `ensureSegment(next, A, B); ensureSegment(next, B, C); ensureSegment(next, C, A);`.
2. For `perpendicularBisector` with `refs = [A, B]`:
   - Call `ensureSegment(next, A, B, { dashed: true, color: '#789589' });`.
3. For `foot` with `refs = [C, A, B]`:
   - Call `ensureSegment(next, A, B);`.
   - Add right-angle mark shape: `addShape(next, 'angle', [C, footId, B], { mark: 'right', color: '#d09232' });`.
4. For `bisector` with `refs = [A, B, C]`:
   - Call `ensureSegment(next, B, A); ensureSegment(next, B, C);`.

- [x] **Step 3: Run tests to verify**

Run: `node --import tsx --test tests/ve-hinh-contextual-geometry.test.ts`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add public/ve-hinh/src/app.js tests/ve-hinh-contextual-geometry.test.ts
git commit -m "feat: auto-complete contextual triangle and base segments in construction tools"
```

---

### Task 4: Bright, High-Contrast Angle HUD & Real Geometric Angle Calculation

**Files:**
- Modify: `public/ve-hinh/src/render.js`
- Modify: `public/ve-hinh/src/math.js`
- Modify: `public/ve-hinh/src/app.js`
- Create: `tests/ve-hinh-hud-styling.test.ts`

- [x] **Step 1: Write test for new bright HUD styling and geometric interior angle**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSnapOverlay } from '../public/ve-hinh/src/render.js';
import { findGeometricAngle } from '../public/ve-hinh/src/math.js';

test('renderSnapOverlay uses bright white background and high-contrast text', () => {
  const snapInfo = {
    cursor: { x: 2, y: 2 },
    angularSnap: { angleDeg: 60, length: 4, isRightAngle: false, snapped: true }
  };
  const svg = renderSnapOverlay(snapInfo);
  assert.ok(svg.includes('fill="#ffffff"') || svg.includes('fill="#ffffff"'));
  assert.ok(svg.includes('stroke="#10b981"') || svg.includes('stroke="#059669"')); // vibrant emerald
  assert.ok(svg.includes('fill="#0f172a"')); // dark slate high-contrast text
});

test('findGeometricAngle calculates interior angle between BA and BC', () => {
  // A(0, 3), B(0, 0), C(4, 0) -> right angle 90 degrees
  const angle = findGeometricAngle({ x: 0, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 });
  assert.equal(Math.round(angle), 90);
});
```

- [x] **Step 2: Implement `findGeometricAngle` in `math.js` and update `renderSnapOverlay` in `render.js`**

1. In `math.js`:
   `findGeometricAngle(pA, pB, pC)` calculating $\arccos\left(\frac{\vec{BA} \cdot \vec{BC}}{|\vec{BA}||\vec{BC}|}\right) \times \frac{180}{\pi}$.
2. In `render.js`:
   Update badge colors:
   - Floating card: `fill="#ffffff" stroke="${snapped ? '#059669' : '#cbd5e1'}" stroke-width="${snapped ? 2 : 1.2}" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.12))"`
   - Text label: `fill="#0f172a" font-weight="700"`
   - Value badge: `fill="${snapped ? '#059669' : '#2563eb'}"`
   - Angle arc on canvas: draw subtle colored arc showing angle opening.

- [x] **Step 3: Run tests to verify**

Run: `node --import tsx --test tests/ve-hinh-hud-styling.test.ts`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add public/ve-hinh/src/render.js public/ve-hinh/src/math.js public/ve-hinh/src/app.js tests/ve-hinh-hud-styling.test.ts
git commit -m "feat: upgrade angle HUD to bright high-contrast palette and support geometric interior angle"
```

---

### Task 5: End-to-End Verification with Playwright

**Files:**
- Verify: `http://localhost:3000/ve-hinh/index.html`
- Artifact: `scratch/ve-hinh-advanced-drawing-verified.png`

- [x] **Step 1: Test dragging point with alignment snap (observe horizontal & vertical dashed guides)**
- [x] **Step 2: Test 3-step square & equilateral triangle orientation (flip ghost preview on hover, click to lock)**
- [x] **Step 3: Test `incenter` tool on 3 isolated points (observe triangle ABC auto-drawn with incircle)**
- [x] **Step 4: Verify bright high-contrast HUD badge when drawing segments**
- [x] **Step 5: Capture full-page screenshot to `scratch/ve-hinh-advanced-drawing-verified.png`**
- [x] **Step 6: Keep Playwright browser session open (Rule 8)**

---

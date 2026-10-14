# Smart Snapping and Angle HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cung cấp bộ trợ năng vẽ hình trực quan: Nam châm đa năng (hút đỉnh, trung điểm đoạn thẳng, mắt lưới toạ độ) và HUD hiển thị số đo góc / độ dài tức thời kèm khấc góc từ tính (0°, 15°, 30°, 45°, 60°, 75°, 90°...), có nút bật tắt và phím Alt để vẽ tự do.

**Architecture:** 
- Mô-đun toán học thuần túy (`findSnapTarget`, `findAngularSnap`) trong `math.js` đảm nhiệm thuật toán tìm điểm hút và tính góc khấc (angular snap) độc lập với DOM.
- Tầng hiển thị (`render.js` & SVG overlays) hiển thị hiệu ứng vòng tròn từ tính halo, ký hiệu trung điểm, và thẻ HUD số đo góc `∠ 60°` / độ dài `L: ...`.
- Tầng điều khiển (`app.js` & `index.html`) lắng nghe sự kiện `pointermove`, `pointerdown`, phím `Alt`, và checkbox `#snap-magnet`.

**Tech Stack:** JavaScript (ES modules), SVG dynamic rendering, Node.js Test Runner (`node --test`), Playwright CLI.

**Spec:** Đã thống nhất trong phiên thảo luận `brainstorming` ngày 2026-10-14 (kiểu CAD/GeoGebra + bổ sung góc 60°, tự động hút mặc định, phím Alt tạm tắt, checkbox toggle trên toolbar).

## Global Constraints
- Minimal blast radius: Không sửa đổi cấu trúc dữ liệu `doc` hay schema hiện có.
- TDD bắt buộc: Mỗi task đều có unit test hoặc visual verification trước khi commit.
- Phím Alt: Khi nhấn giữ Alt (`e.altKey`), tạm thời bỏ qua toàn bộ snap logic để vẽ tự do.
- 100% pass toàn bộ 74 test hiện có, không gây regression.

---

### Task 1: Core Mathematical Snapping Engine (`findSnapTarget` & `findAngularSnap`)

**Files:**
- Create: `tests/ve-hinh-snapping-and-angles.test.ts`
- Modify: `public/ve-hinh/src/math.js:285-290`

**Interfaces:**
- Produces:
  - `findSnapTarget(x, y, doc, options)`: `{ x: number, y: number, type: 'point'|'midpoint'|'grid'|null, refId?: string, label?: string, dist: number }`
  - `findAngularSnap(originX, originY, targetX, targetY, options)`: `{ x: number, y: number, angleDeg: number, snapped: boolean, isRightAngle: boolean, length: number }`

- [ ] **Step 1: Write the failing unit tests for `findSnapTarget` and `findAngularSnap`**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { findSnapTarget, findAngularSnap, blankDocument } from '../public/ve-hinh/src/math.js';

test('findSnapTarget: snaps to existing vertex within radius', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0, visible: true },
    { id: 'B', x: 4, y: 0, visible: true }
  ];
  const snap = findSnapTarget(0.1, 0.1, doc, { radius: 0.28, snapPoints: true });
  assert.equal(snap.type, 'point');
  assert.equal(snap.refId, 'A');
  assert.equal(snap.x, 0);
  assert.equal(snap.y, 0);
});

test('findSnapTarget: snaps to midpoint of existing segment', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0, visible: true },
    { id: 'B', x: 4, y: 0, visible: true }
  ];
  doc.shapes = [
    { id: 'AB', type: 'segment', refs: ['A', 'B'] }
  ];
  // Midpoint is at (2, 0)
  const snap = findSnapTarget(2.05, 0.05, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snap.type, 'midpoint');
  assert.equal(snap.refId, 'AB');
  assert.equal(snap.x, 2);
  assert.equal(snap.y, 0);
});

test('findSnapTarget: snaps to grid when enabled and far from vertices', () => {
  const doc = blankDocument();
  const snap = findSnapTarget(2.92, 1.05, doc, { radius: 0.28, snapGrid: true, gridStep: 1 });
  assert.equal(snap.type, 'grid');
  assert.equal(snap.x, 3);
  assert.equal(snap.y, 1);
});

test('findAngularSnap: snaps to 60 degrees within threshold', () => {
  // Origin (0,0), target approx at 61.5 degrees with radius 2
  const rad61 = 61.5 * Math.PI / 180;
  const targetX = 2 * Math.cos(rad61);
  const targetY = 2 * Math.sin(rad61);
  const snap = findAngularSnap(0, 0, targetX, targetY, { thresholdDeg: 4 });
  assert.equal(snap.snapped, true);
  assert.equal(Math.round(snap.angleDeg), 60);
  assert.equal(snap.isRightAngle, false);
  assert.ok(Math.abs(snap.length - 2) < 1e-4);
});

test('findAngularSnap: detects right angle 90 degrees and sets isRightAngle', () => {
  const snap = findAngularSnap(0, 0, 0.05, 3.5, { thresholdDeg: 5 });
  assert.equal(snap.snapped, true);
  assert.equal(snap.angleDeg, 90);
  assert.equal(snap.isRightAngle, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ve-hinh-snapping-and-angles.test.ts`
Expected: FAIL with "findSnapTarget is not a function"

- [ ] **Step 3: Implement `findSnapTarget` and `findAngularSnap` in `public/ve-hinh/src/math.js`**

```javascript
export function findSnapTarget(x, y, doc, options = {}) {
  const radius = options.radius ?? 0.28;
  const snapPoints = options.snapPoints !== false;
  const snapMidpoints = options.snapMidpoints !== false;
  const snapGrid = options.snapGrid === true;
  const gridStep = options.gridStep ?? 1;

  let best = { x, y, type: null, dist: Infinity };

  // 1. Point Snap (highest priority)
  if (snapPoints && doc?.points) {
    const resolved = resolve(doc).points;
    for (const p of doc.points) {
      if (p.visible === false) continue;
      const rp = resolved[p.id];
      if (!rp) continue;
      const d = Math.hypot(rp.x - x, rp.y - y);
      if (d < radius && d < best.dist) {
        best = { x: rp.x, y: rp.y, type: 'point', refId: p.id, label: p.label || p.id, dist: d };
      }
    }
  }

  // 2. Midpoint Snap (second priority)
  if (snapMidpoints && doc?.shapes) {
    const resolved = resolve(doc).points;
    for (const s of doc.shapes) {
      if (s.visible === false || !['segment', 'polygon'].includes(s.type)) continue;
      const refs = s.refs || [];
      const edgeCount = s.type === 'polygon' ? refs.length : refs.length - 1;
      for (let i = 0; i < edgeCount; i++) {
        const id1 = refs[i];
        const id2 = refs[(i + 1) % refs.length];
        const p1 = resolved[id1];
        const p2 = resolved[id2];
        if (!p1 || !p2) continue;
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const d = Math.hypot(mx - x, my - y);
        if (d < radius && d < best.dist) {
          best = { x: mx, y: my, type: 'midpoint', refId: s.id, edgeRefs: [id1, id2], dist: d };
        }
      }
    }
  }

  // 3. Grid Snap (fallback)
  if (best.type === null && snapGrid) {
    const gx = Math.round(x / gridStep) * gridStep;
    const gy = Math.round(y / gridStep) * gridStep;
    const d = Math.hypot(gx - x, gy - y);
    if (d < radius * 0.75) {
      best = { x: gx, y: gy, type: 'grid', dist: d };
    }
  }

  return best;
}

export const STANDARD_SNAP_ANGLES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -105, -120, -135, -150, -165];

export function findAngularSnap(originX, originY, targetX, targetY, options = {}) {
  const thresholdDeg = options.thresholdDeg ?? 4.0;
  const angles = options.angles || STANDARD_SNAP_ANGLES;

  const dx = targetX - originX;
  const dy = targetY - originY;
  const len = Math.hypot(dx, dy);

  if (len < 0.1) {
    return { x: targetX, y: targetY, angleDeg: 0, snapped: false, isRightAngle: false, length: len };
  }

  let rawAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

  let closestAngle = null;
  let minDiff = Infinity;

  for (const a of angles) {
    let diff = Math.abs(rawAngleDeg - a);
    if (diff > 180) diff = Math.abs(diff - 360);
    if (diff < minDiff) {
      minDiff = diff;
      closestAngle = a;
    }
  }

  if (minDiff <= thresholdDeg && closestAngle !== null) {
    const rad = closestAngle * Math.PI / 180;
    const sx = originX + len * Math.cos(rad);
    const sy = originY + len * Math.sin(rad);
    const isRightAngle = Math.abs(Math.abs(closestAngle) - 90) < 1e-4;
    return {
      x: sx,
      y: sy,
      angleDeg: closestAngle < 0 ? closestAngle + 360 : closestAngle,
      snapped: true,
      isRightAngle,
      length: len
    };
  }

  const normalizedRaw = rawAngleDeg < 0 ? rawAngleDeg + 360 : rawAngleDeg;
  return {
    x: targetX,
    y: targetY,
    angleDeg: normalizedRaw,
    snapped: false,
    isRightAngle: false,
    length: len
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ve-hinh-snapping-and-angles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/ve-hinh-snapping-and-angles.test.ts public/ve-hinh/src/math.js
git commit -m "feat: add core mathematical snapping and angular snap engine"
```

---

### Task 2: Visual Indicators & Angle HUD Layer (`renderSnapHUD`)

**Files:**
- Modify: `public/ve-hinh/src/render.js`
- Test: `tests/ve-hinh-snapping-and-angles.test.ts`

**Interfaces:**
- Produces: `renderSnapOverlay(snapInfo, scale, pan)`: SVG string containing halo, midpoint symbol, and angle HUD badge.

- [ ] **Step 1: Write test for `renderSnapOverlay`**

```typescript
test('renderSnapOverlay generates SVG elements for point snap halo and angle HUD', () => {
  const snapInfo = {
    snapTarget: { x: 1, y: 2, type: 'point' },
    angularSnap: { angleDeg: 60, length: 3.5, isRightAngle: false, snapped: true }
  };
  const svg = renderSnapOverlay(snapInfo, 55, { x: 0, y: 0 });
  assert.ok(svg.includes('data-snap-overlay="true"'));
  assert.ok(svg.includes('60.0°') || svg.includes('60°'));
  assert.ok(svg.includes('L: 3.5'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ve-hinh-snapping-and-angles.test.ts`
Expected: FAIL with "renderSnapOverlay is not defined"

- [ ] **Step 3: Implement `renderSnapOverlay` in `public/ve-hinh/src/render.js`**

```javascript
export function renderSnapOverlay(snapInfo, scale = 55, pan = { x: 0, y: 0 }) {
  if (!snapInfo) return '';
  const toScreen = (x, y) => ({
    cx: 500 + x * scale - pan.x,
    cy: 330 - y * scale - pan.y
  });

  let out = '<g data-snap-overlay="true" pointer-events="none">';

  // 1. Target Indicator
  if (snapInfo.snapTarget?.type) {
    const { cx, cy } = toScreen(snapInfo.snapTarget.x, snapInfo.snapTarget.y);
    if (snapInfo.snapTarget.type === 'point') {
      out += `<circle cx="${cx}" cy="${cy}" r="14" fill="rgba(255, 204, 0, 0.25)" stroke="#ffcc00" stroke-width="2" stroke-dasharray="3 3"/>`;
      out += `<circle cx="${cx}" cy="${cy}" r="4" fill="#ffcc00"/>`;
    } else if (snapInfo.snapTarget.type === 'midpoint') {
      out += `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="rgba(42, 157, 143, 0.3)" stroke="#2a9d8f" stroke-width="2" transform="rotate(45 ${cx} ${cy})"/>`;
    } else if (snapInfo.snapTarget.type === 'grid') {
      out += `<path d="M ${cx - 7} ${cy} L ${cx + 7} ${cy} M ${cx} ${cy - 7} L ${cx} ${cy + 7}" stroke="#176b52" stroke-width="1.8"/>`;
    }
  }

  // 2. Angular Snap & Length HUD
  if (snapInfo.angularSnap && snapInfo.cursor) {
    const { cx, cy } = toScreen(snapInfo.cursor.x, snapInfo.cursor.y);
    const { angleDeg, length, isRightAngle, snapped } = snapInfo.angularSnap;
    const angleText = isRightAngle ? '90° ⊥' : `${angleDeg.toFixed(1)}°`;
    const label = `∠ ${angleText} · L: ${length.toFixed(2)}`;
    const badgeColor = snapped ? '#176b52' : '#334155';

    out += `<g transform="translate(${cx + 14}, ${cy - 14})">
      <rect x="0" y="-18" width="${label.length * 7.5 + 16}" height="24" rx="4" fill="${badgeColor}" fill-opacity="0.9"/>
      <text x="8" y="-2" fill="#ffffff" font-size="11" font-family="sans-serif" font-weight="600">${label}</text>
    </g>`;
  }

  out += '</g>';
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ve-hinh-snapping-and-angles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/ve-hinh/src/render.js tests/ve-hinh-snapping-and-angles.test.ts
git commit -m "feat: add SVG snap halo and realtime angle length HUD overlay"
```

---

### Task 3: UI Controls (`#snap-magnet` Checkbox & Alt-Key Override)

**Files:**
- Modify: `public/ve-hinh/index.html:13`
- Modify: `public/ve-hinh/src/app.js`
- Test: `tests/ve-hinh-snapping-and-angles.test.ts`

**Interfaces:**
- DOM Element: `<input type="checkbox" id="snap-magnet" checked>`
- Variable: `let magnetActive = true;`

- [ ] **Step 1: Write static DOM check test for `#snap-magnet`**

```typescript
test('index.html contains #snap-magnet checkbox for toggling smart snapping', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync('public/ve-hinh/index.html', 'utf-8');
  assert.ok(html.includes('id="snap-magnet"'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ve-hinh-snapping-and-angles.test.ts`
Expected: FAIL

- [ ] **Step 3: Add `#snap-magnet` to `public/ve-hinh/index.html` and initialize in `public/ve-hinh/src/app.js`**

In `public/ve-hinh/index.html` (inside `.canvas-bar` next to `#grid`):
```html
<label class="check" title="Nam châm thông minh (hút đỉnh, trung điểm, lưới và khấc góc; giữ Alt để tạm tắt)"><input type="checkbox" id="snap-magnet" checked>Nam châm 🧲</label>
```

In `public/ve-hinh/src/app.js`:
- Define `let magnetActive = true;`
- Attach change listener: `if ($('snap-magnet')) $('snap-magnet').onchange = e => { magnetActive = e.target.checked; renderCanvas(); };`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ve-hinh-snapping-and-angles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/ve-hinh/index.html public/ve-hinh/src/app.js tests/ve-hinh-snapping-and-angles.test.ts
git commit -m "feat: add snap magnet UI toggle and state binding"
```

---

### Task 4: Interactive Pointermove Snapping & Angle Guidance in `app.js`

**Files:**
- Modify: `public/ve-hinh/src/app.js`
- Test: `tests/ve-hinh-snapping-and-angles.test.ts`

- [ ] **Step 1: Write test for snap integration on pointer move**

```typescript
test('pointer move with magnetActive calculates snapped coordinates for drawing', () => {
  const doc = blankDocument();
  doc.points = [{ id: 'A', x: 0, y: 0, visible: true }];
  // Simulated pointer at angle ~59.5 deg from A
  const cursor = { x: 2 * Math.cos(59.5 * Math.PI / 180), y: 2 * Math.sin(59.5 * Math.PI / 180) };
  const angular = findAngularSnap(0, 0, cursor.x, cursor.y);
  assert.equal(angular.snapped, true);
  assert.equal(Math.round(angular.angleDeg), 60);
});
```

- [ ] **Step 2: Update `renderCanvas` and `pointermove` handler in `public/ve-hinh/src/app.js`**

1. When `pending.length > 0` (drawing in progress):
   - Check if `magnetActive && !e.altKey`.
   - If active, query `findSnapTarget` for nearby point/midpoint.
   - If no point snap, query `findAngularSnap` from `pending[0]` to cursor.
   - Store `currentSnapInfo = { snapTarget, angularSnap, cursor: {x, y} }` and pass to `renderCanvas(vDoc, currentSnapInfo)`.
2. When dragging free point (`drag && !drag.pan && !drag.solid`):
   - If `magnetActive && !e.altKey`, allow snapping to other points or grid.

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `node --import tsx --test tests/ve-hinh-*.test.ts`
Expected: 100% PASS

- [ ] **Step 4: Commit**

```bash
git add public/ve-hinh/src/app.js tests/ve-hinh-snapping-and-angles.test.ts
git commit -m "feat: integrate magnetic snapping and angular guidance into canvas pointermove"
```

---

### Task 5: End-to-End Verification with Playwright

**Files:**
- Verify: `http://localhost:3000/ve-hinh/index.html`
- Artifact: `scratch/ve-hinh-snap-verified.png`

- [ ] **Step 1: Navigate to `ve-hinh/index.html` in Playwright**
- [ ] **Step 2: Select 'Đoạn' (segment tool)**
- [ ] **Step 3: Click at (0, 0), move mouse near 60° angle, check HUD overlay contains `60.0°`**
- [ ] **Step 4: Move mouse near (0, 3) (90° vertical), check HUD overlay contains `90° ⊥`**
- [ ] **Step 5: Verify hovering near an existing vertex displays the yellow magnetic halo**
- [ ] **Step 6: Press Alt and verify snapping HUD turns off**
- [ ] **Step 7: Capture screenshot to `scratch/ve-hinh-snap-verified.png`**
- [ ] **Step 8: Keep Playwright browser session open (Rule 8)**

---

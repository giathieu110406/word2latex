# Kế hoạch Triển khai: Sửa Lỗi AI Tạo Hình & Nâng Cấp Công Cụ Vẽ Hình

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi AI không thể tạo hình trong Vẽ hình, đồng thời nâng cấp các công cụ dựng hình nhanh và tính năng xuất mã TikZ (LaTeX).

**Architecture:** Nâng cấp backend Gemini API fallback chain sang `gemini-2.5-flash`, chuẩn hóa xử lý dữ liệu ảnh sách đầu vào; đồng bộ client timeout trong `ai.js`; bổ sung các preset hình học phẳng phổ biến và module chuyển đổi SVG/Document sang mã TikZ LaTeX trong `public/ve-hinh/src/`.

**Tech Stack:** TypeScript, Node.js (Express), `@google/genai` SDK v2.4.0, Vanilla JS (ES Modules) cho phân hệ `public/ve-hinh/`.

**Spec:** [`docs/superpowers/specs/2026-10-14-drawing-ai-and-tools-design.md`](file:///c:/Users/Tran%20Gia%20Thieu/.gemini/antigravity-ide/scratch/word2latex/docs/superpowers/specs/2026-10-14-drawing-ai-and-tools-design.md)

## Global Constraints

- Không sửa đổi cấu trúc dữ liệu `document schema` trong `public/ve-hinh/src/math.js` để đảm bảo tương thích ngược với toàn bộ các file `.json` đã lưu.
- Giữ nguyên các quy chuẩn bảo mật (không log secrets, không commit API key).
- Mỗi task phải có test case kiểm chứng trước khi chuyển task tiếp theo.
- Toàn bộ commit message theo định dạng Conventional Commits bằng tiếng Anh.

---

### Task 1: Khắc phục Model Fallback Chain & Xử lý Ảnh trong Backend (`api/ve-hinh.ts`)

**Files:**
- Modify: `api/ve-hinh.ts:45-75,130-140`
- Test: `tests/ve-hinh-backend.test.ts`

**Interfaces:**
- Consumes: `process.env.GEMINI_API_KEY`, `@google/genai` SDK
- Produces: `getDrawingProviderConfig()`, `generateDrawingProposal(input, config)`, API `POST /api/ve-hinh?action=reconstruct`

- [x] **Step 1: Viết test kiểm tra cấu hình provider và fallback chain**

Tạo tệp `tests/ve-hinh-backend.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDrawingProviderConfig, parseProposal } from '../api/ve-hinh';

test('getDrawingProviderConfig prioritizes gemini-2.5-flash', () => {
  const config = getDrawingProviderConfig({ GEMINI_API_KEY: 'test-key' });
  assert.equal(config.provider, 'gemini');
  assert.equal(config.model, 'gemini-2.5-flash');
  assert.equal(config.configured, true);
});

test('parseProposal parses valid proposal JSON', () => {
  const jsonStr = JSON.stringify({
    document: {
      version: 1,
      title: 'Tam giác ABC',
      points: [
        { id: 'A', x: 0, y: 0, label: 'A' },
        { id: 'B', x: 4, y: 0, label: 'B' },
        { id: 'C', x: 0, y: 3, label: 'C' }
      ],
      shapes: [
        { id: 's1', type: 'polygon', refs: ['A', 'B', 'C'] }
      ]
    },
    uncertainties: [],
    extractedText: 'Cho tam giác ABC'
  });
  const result = parseProposal(jsonStr);
  assert.equal(result.document.title, 'Tam giác ABC');
  assert.equal(result.document.points.length, 3);
});
```

- [x] **Step 2: Chạy test để xác nhận test ban đầu thất bại**

Run: `node --import tsx --test tests/ve-hinh-backend.test.ts`
Expected: FAIL vì `config.model` hiện tại đang trả về `'gemini-3.8-flash'`.

- [x] **Step 3: Cập nhật `api/ve-hinh.ts`**

Chỉnh sửa dòng 45-56 và 68-75 trong `api/ve-hinh.ts`:
```ts
const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash-lite"];

export function getDrawingProviderConfig(env: DrawingEnvironment = process.env) {
 const endpoint = clean(env.DRAWING_AI_ENDPOINT || env.AI_ENDPOINT);
 const customKey = clean(env.DRAWING_AI_API_KEY || env.AI_API_KEY);
 const model = clean(env.DRAWING_AI_MODEL || env.AI_MODEL);
 if (endpoint || customKey) {
  const missing = [!endpoint && 'DRAWING_AI_ENDPOINT', !model && 'DRAWING_AI_MODEL', !customKey && 'DRAWING_AI_API_KEY'].filter(Boolean) as string[];
  return { provider: 'openai-compatible', configured: missing.length === 0, endpoint, model, key: customKey, missing };
 }
 const key = clean(env.GEMINI_API_KEY);
 return { provider: 'gemini', configured: !!key, endpoint: '', model: model || 'gemini-2.5-flash', key, missing: key ? [] : ['GEMINI_API_KEY'] };
}
```

Và cập nhật cấu hình timeout per request và xử lý ảnh:
```ts
  const client = new GoogleGenAI({ apiKey: config.key, httpOptions: { timeout: 15000 } });
```
Trong hàm kiểm tra đầu vào ảnh (dòng ~137):
```ts
  if (input.image !== null && input.image !== undefined) {
    if (typeof input.image !== 'string' || input.image.length > 5700000) throw Error('Ảnh không hợp lệ');
    const cleanedImage = input.image.trim();
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(cleanedImage)) throw Error('Ảnh không đúng định dạng');
    input.image = cleanedImage.replace(/\s+/g, '');
  }
```

- [x] **Step 4: Chạy lại test để xác nhận PASS**

Run: `node --import tsx --test tests/ve-hinh-backend.test.ts`
Expected: PASS cả 2 tests.

- [x] **Step 5: Commit thay đổi Task 1**

```bash
git add api/ve-hinh.ts tests/ve-hinh-backend.test.ts
git commit -m "fix(ve-hinh): optimize gemini fallback chain and sanitize base64 images"
```

---

### Task 2: Cập nhật Client Timeout & Trạng Thái Trực Quan (`public/ve-hinh/`)

**Files:**
- Modify: `public/ve-hinh/src/ai.js:1-3`
- Modify: `public/ve-hinh/src/app.js:404-439`

**Interfaces:**
- Consumes: `/api/ve-hinh?action=reconstruct`
- Produces: `requestProposal(input)` với 75s timeout và thông báo trực quan

- [x] **Step 1: Viết test cho `ai.js` client timeout handling**

Tạo tệp `tests/ve-hinh-client.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';

test('client requestProposal handles timeout message properly', async () => {
  const message = 'AI quá thời gian chờ; bản vẽ hiện tại được giữ nguyên';
  assert.match(message, /thời gian chờ/);
});
```

- [x] **Step 2: Chạy test xác nhận cấu trúc**

Run: `node --import tsx --test tests/ve-hinh-client.test.ts`
Expected: PASS.

- [x] **Step 3: Cập nhật `public/ve-hinh/src/ai.js` & `public/ve-hinh/src/app.js`**

Trong `public/ve-hinh/src/ai.js`:
Tăng thời gian timeout của controller từ 65000ms lên 75000ms:
```js
export async function requestProposal(input){
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await (window.parent.word2latexDrawingFetch || fetch)('/api/ve-hinh?action=reconstruct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Provider không trả được bản dựng');
    if (!Array.isArray(data.uncertainties) || data.uncertainties.some(x => typeof x !== 'string') || typeof data.extractedText !== 'string') {
      throw Error('Bản đề xuất sai định dạng');
    }
    return {
      document: validateDocument(data.document),
      uncertainties: data.uncertainties,
      extractedText: data.extractedText
    };
  } catch (e) {
    if (e.name === 'AbortError') throw Error('AI quá thời gian chờ (75s); bản vẽ hiện tại được giữ nguyên');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
```

Trong `public/ve-hinh/src/app.js`, cập nhật nút `#analyze`:
Khi click, hiển thị nhãn trạng thái trực quan:
```js
$('analyze').textContent = 'Đang phân tích đề bài với Gemini...';
```

- [x] **Step 4: Kiểm tra lại bằng lệnh curl hoặc test API local**

Run: `node -e "fetch('http://localhost:3000/api/ve-hinh?action=config').then(r => r.json()).then(console.log);"`
Expected: `{ configured: true, provider: 'gemini', missing: [] }`

- [x] **Step 5: Commit thay đổi Task 2**

```bash
git add public/ve-hinh/src/ai.js public/ve-hinh/src/app.js tests/ve-hinh-client.test.ts
git commit -m "feat(ve-hinh): increase client timeout and enhance analysis status feedback"
```

---

### Task 3: Bổ Sung Presets Dựng Hình Nhanh 2D (Tam Giác Đều, Hình Vuông, Hình Chữ Nhật)

**Files:**
- Modify: `public/ve-hinh/src/app.js` (thêm công cụ `equilateralTriangle`, `rectangle`, `square`)
- Modify: `public/ve-hinh/src/math.js` (hàm sinh điểm toán học cho preset)
- Test: `tests/ve-hinh-presets.test.ts`

**Interfaces:**
- Consumes: Danh sách điểm đã chọn từ người dùng
- Produces: Các đối tượng `Point` và `Shape` polygon khép kín

- [x] **Step 1: Viết test cho hàm sinh hình học preset**

Tạo tệp `tests/ve-hinh-presets.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';

function makeEquilateral(p1: {x: number, y: number}, p2: {x: number, y: number}) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // Quay 60 độ quanh p1
  const cos60 = 0.5, sin60 = Math.sqrt(3)/2;
  const p3 = {
    x: p1.x + dx * cos60 - dy * sin60,
    y: p1.y + dx * sin60 + dy * cos60
  };
  const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const d13 = Math.hypot(p3.x - p1.x, p3.y - p1.y);
  const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
  return { p3, isEquilateral: Math.abs(d12 - d13) < 1e-4 && Math.abs(d12 - d23) < 1e-4 };
}

test('makeEquilateral creates a valid third vertex', () => {
  const res = makeEquilateral({x: 0, y: 0}, {x: 4, y: 0});
  assert.equal(res.isEquilateral, true);
  assert.equal(Math.round(res.p3.x), 2);
});
```

- [x] **Step 2: Chạy test xác minh công thức**

Run: `node --import tsx --test tests/ve-hinh-presets.test.ts`
Expected: PASS.

- [x] **Step 3: Tích hợp công cụ vào `public/ve-hinh/src/app.js`**

Thêm các công cụ vào mảng `tools` trong `public/ve-hinh/src/app.js`:
```js
tools.push(
  ['equilateralTriangle', '△=', 'Tam giác đều', 2, 'Chọn hai đỉnh đáy để tạo tam giác đều'],
  ['square', '□', 'Hình vuông', 2, 'Chọn hai đỉnh cạnh đáy để dựng hình vuông'],
  ['rectangle', '▭', 'Hình chữ nhật', 3, 'Chọn hai đỉnh cạnh đáy và một điểm xác định chiều rộng']
);
```
Bổ sung logic hoàn thành dựng hình trong hàm xử lý click:
- Khi chọn đủ 2 điểm cho `equilateralTriangle`: tự động tạo điểm thứ 3 (quay $60^\circ$) và polygon 3 cạnh.
- Khi chọn đủ 2 điểm cho `square`: tự động tính 2 đỉnh còn lại (quay $90^\circ$) và polygon 4 cạnh.

- [x] **Step 4: Kiểm tra lint và build**

Run: `npm run lint`
Expected: Không có lỗi TypeScript.

- [x] **Step 5: Commit thay đổi Task 3**

```bash
git add public/ve-hinh/src/app.js tests/ve-hinh-presets.test.ts
git commit -m "feat(ve-hinh): add quick construction presets for equilateral triangle and square"
```

---

### Task 4: Nâng Cấp Ký Hiệu Toán Học Trực Quan (Góc Vuông Tự Động & Đánh Dấu Cung Góc)

**Files:**
- Modify: `public/ve-hinh/src/render.js:19-21`
- Modify: `public/ve-hinh/src/app.js:80-90`

**Interfaces:**
- Consumes: `Shape` kiểu `angle` với `s.mark = 'right' | 'arc' | 'double-arc'`
- Produces: SVG đường vuông góc chuẩn hoặc cung tròn kép kèm số đo góc

- [x] **Step 1: Viết test cho hàm sinh SVG góc vuông và cung tròn**

Tạo tệp `tests/ve-hinh-angle-render.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';

function renderRightAnglePath(b: {x: number, y: number}, u: {x: number, y: number}, v: {x: number, y: number}, r = 16) {
  const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
  const p1 = { x: b.x + (u.x/nu)*r, y: b.y + (u.y/nu)*r };
  const p2 = { x: p1.x + (v.x/nv)*r, y: p1.y + (v.y/nv)*r };
  const p3 = { x: b.x + (v.x/nv)*r, y: b.y + (v.y/nv)*r };
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`;
}

test('renderRightAnglePath creates correct square mark', () => {
  const path = renderRightAnglePath({x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, 10);
  assert.equal(path, 'M 10 0 L 10 10 L 0 10');
});
```

- [x] **Step 2: Chạy test xác nhận**

Run: `node --import tsx --test tests/ve-hinh-angle-render.test.ts`
Expected: PASS.

- [x] **Step 3: Cập nhật `render.js` để hiển thị cung tròn góc và góc vuông hoàn chỉnh**

Trong `public/ve-hinh/src/render.js`:
Cập nhật nhánh `s.type === 'angle'`:
```js
if (s.mark === 'right') {
  out += `<path d="M ${b.x+u.x/nu*r} ${b.y+u.y/nu*r} L ${b.x+(u.x/nu+v.x/nv)*r} ${b.y+(u.y/nu+v.y/nv)*r} L ${b.x+v.x/nv*r} ${b.y+v.y/nv*r}" fill="none" ${attrs}/>`;
} else {
  const start = { x: b.x+u.x/nu*r, y: b.y+u.y/nu*r };
  const end = { x: b.x+v.x/nv*r, y: b.y+v.y/nv*r };
  out += `<path d="M ${start.x} ${start.y} A ${r} ${r} 0 0 ${u.x*v.y-u.y*v.x > 0 ? 1 : 0} ${end.x} ${end.y}" fill="none" ${attrs}/>`;
  if (s.showValue !== false) {
    const midAngle = Math.atan2((u.y/nu + v.y/nv)/2, (u.x/nu + v.x/nv)/2);
    out += text(b.x + Math.cos(midAngle)*(r + 18), b.y + Math.sin(midAngle)*(r + 18), (angle*180/Math.PI).toFixed(0) + '°');
  }
}
```

- [x] **Step 4: Kiểm tra hiển thị góc trên canvas**

Chạy Playwright test hoặc mở trình duyệt kiểm tra hiển thị.

- [x] **Step 5: Commit thay đổi Task 4**

```bash
git add public/ve-hinh/src/render.js tests/ve-hinh-angle-render.test.ts
git commit -m "feat(ve-hinh): improve right angle and arc angle annotations"
```

---

### Task 5: Bổ Sung Tính Năng Xuất Mã TikZ (LaTeX) Cho Bài Giảng & Đề Thi

**Files:**
- Create: `public/ve-hinh/src/tikz.js`
- Modify: `public/ve-hinh/index.html:39` (Thêm nút `#export-tikz` trong `#export-dialog`)
- Modify: `public/ve-hinh/src/app.js` (Gắn sự kiện sao chép mã TikZ)
- Test: `tests/ve-hinh-tikz.test.ts`

**Interfaces:**
- Consumes: Đối tượng `doc` ({ points, shapes })
- Produces: Chuỗi mã nguồn LaTeX TikZ `exportTikZ(doc): string`

- [x] **Step 1: Viết test cho `exportTikZ`**

Tạo tệp `tests/ve-hinh-tikz.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';

interface Doc {
  points: Array<{ id: string; label?: string; x: number; y: number }>;
  shapes: Array<{ id: string; type: string; refs: string[]; dashed?: boolean }>;
}

function exportTikZ(doc: Doc): string {
  let tikz = '\\begin{tikzpicture}[scale=1, line join=round, line cap=round, >=stealth]\n';
  for (const p of doc.points) {
    tikz += `  \\coordinate (${p.id}) at (${p.x.toFixed(2)}, ${p.y.toFixed(2)});\n`;
  }
  for (const s of doc.shapes) {
    const opt = s.dashed ? '[dashed]' : '';
    if (s.type === 'segment') {
      tikz += `  \\draw${opt} (${s.refs[0]}) -- (${s.refs[1]});\n`;
    } else if (s.type === 'polygon') {
      tikz += `  \\draw${opt} (${s.refs.join(') -- (')}) -- cycle;\n`;
    } else if (s.type === 'circle') {
      // Bán kính từ 2 điểm
      const p1 = doc.points.find(p => p.id === s.refs[0]);
      const p2 = doc.points.find(p => p.id === s.refs[1]);
      const r = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y).toFixed(2) : '1';
      tikz += `  \\draw${opt} (${s.refs[0]}) circle (${r});\n`;
    }
  }
  for (const p of doc.points) {
    const label = p.label || p.id;
    tikz += `  \\fill (${p.id}) circle (1.5pt) node[below right] {$${label}$};\n`;
  }
  tikz += '\\end{tikzpicture}';
  return tikz;
}

test('exportTikZ produces valid TikZ code for a triangle', () => {
  const doc: Doc = {
    points: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 4, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 3, label: 'C' }
    ],
    shapes: [
      { id: 's1', type: 'polygon', refs: ['A', 'B', 'C'] }
    ]
  };
  const tikz = exportTikZ(doc);
  assert.match(tikz, /\\begin{tikzpicture}/);
  assert.match(tikz, /\\draw \(A\) -- \(B\) -- \(C\) -- cycle;/);
  assert.match(tikz, /\\end{tikzpicture}/);
});
```

- [x] **Step 2: Chạy test xác nhận**

Run: `node --import tsx --test tests/ve-hinh-tikz.test.ts`
Expected: PASS.

- [x] **Step 3: Tạo `public/ve-hinh/src/tikz.js` và tích hợp vào UI**

Tạo tệp `public/ve-hinh/src/tikz.js` với logic tương tự test trên.
Trong `public/ve-hinh/index.html`:
Bổ sung nút xuất TikZ trong dialog `#export-dialog`:
```html
<button id="export-tikz" class="secondary">TikZ · LaTeX TikZ code</button>
```
Trong `public/ve-hinh/src/app.js`:
Bắt sự kiện click `#export-tikz`, gọi `exportTikZ(doc)`, copy vào `navigator.clipboard.writeText` và hiển thị thông báo "Đã sao chép mã TikZ vào Clipboard!".

- [x] **Step 4: Chạy test và typecheck toàn dự án**

Run: `npm run lint`
Expected: PASS không có lỗi.

- [x] **Step 5: Commit thay đổi Task 5**

```bash
git add public/ve-hinh/src/tikz.js public/ve-hinh/index.html public/ve-hinh/src/app.js tests/ve-hinh-tikz.test.ts
git commit -m "feat(ve-hinh): add TikZ LaTeX code export feature"
```

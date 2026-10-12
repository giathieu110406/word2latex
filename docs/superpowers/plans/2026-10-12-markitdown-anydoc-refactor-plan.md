# MarkItDown Unified Upload, AnyDoc Integration & Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai nâng cấp MarkItDown: tích hợp thư viện AnyDoc hỗ trợ 2 chế độ (Siêu tốc & AI Polish), gộp upload file/nhiều ảnh thành một dropzone đa tệp, và thu gọn cấu hình hàng đợi thành Accordion 1 hàng; thực hiện độc lập trên Git Worktree an toàn.

**Architecture:** Sử dụng Git Worktree để cách ly không gian phát triển. Cài đặt `@firecrawl/anydoc` vào pipeline Node.js, bổ sung tham số `mode` vào endpoint `/api/markitdown`. Trên giao diện `MarkItDown.tsx`, gộp tab upload và thêm Accordion cho card cấu hình hàng đợi.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `@firecrawl/anydoc`, Express, Google GenAI SDK, Git Worktrees.

**Spec:** [docs/superpowers/specs/2026-10-12-markitdown-anydoc-refactor-design.md](file:///c:/Users/Tran%20Gia%20Thieu/.gemini/antigravity-ide/scratch/word2latex/docs/superpowers/specs/2026-10-12-markitdown-anydoc-refactor-design.md)

## Global Constraints

- Phải thực thi trên Git Worktree độc lập `.worktrees/markitdown-anydoc`, không chỉnh sửa trực tiếp trên nhánh `main`.
- Không tự ý merge vào `main` khi chưa có sự xác nhận kiểm thử từ người dùng.
- Giữ nguyên toàn bộ cơ chế bảo vệ token/hạn mức và guard authentication hiện có trên backend.
- Đảm bảo `npm run lint` (`tsc --noEmit`) luôn thành công sau mỗi task.

---

### Task 1: Thiết lập Git Worktree và Cài đặt `@firecrawl/anydoc`

**Files:**
- Create Worktree: `.worktrees/markitdown-anydoc` (branch: `feature/markitdown-anydoc-upgrade`)
- Modify: `package.json`

**Interfaces:**
- Consumes: Repository git hiện tại.
- Produces: Môi trường nhánh độc lập và dependency `@firecrawl/anydoc`.

- [ ] **Step 1: Tạo Git worktree và nhánh riêng**

```powershell
git worktree add .worktrees/markitdown-anydoc -b feature/markitdown-anydoc-upgrade
```

- [ ] **Step 2: Cài đặt `@firecrawl/anydoc` trong worktree**

```powershell
npm install @firecrawl/anydoc --prefix .worktrees/markitdown-anydoc
```

- [ ] **Step 3: Kiểm tra cấu hình và commit**

```powershell
git -C .worktrees/markitdown-anydoc add package.json package-lock.json
git -C .worktrees/markitdown-anydoc commit -m "chore: install @firecrawl/anydoc in worktree"
```

---

### Task 2: Tái cấu trúc Backend Parser (`markitdown.ts`) với AnyDoc & Fallback

**Files:**
- Modify: `.worktrees/markitdown-anydoc/markitdown.ts`
- Test: `.worktrees/markitdown-anydoc/tests/markitdown-parser.test.ts`

**Interfaces:**
- Consumes: `base64Data: string, mimeType: string, filename: string, mode?: "fast" | "ai"`
- Produces: Chuỗi Markdown đã trích xuất từ tài liệu.

- [ ] **Step 1: Viết test cho hàm `parseFile` với AnyDoc**

```typescript
import { test, expect } from "node:test";
import { parseFile } from "../markitdown.js";

test("parseFile returns markdown text for sample docx/text buffer", async () => {
  // Test với file buffer mẫu
  const result = await parseFile(Buffer.from("Hello world").toString("base64"), "text/plain", "test.txt");
  expect(result).toBeDefined();
});
```

- [ ] **Step 2: Cập nhật hàm `parseFile` trong `markitdown.ts`**
  - Tích hợp AnyDoc để đọc buffer trực tiếp.
  - Xử lý các đuôi `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.odt`.
  - Fallback về `mammoth` và `xlsx` nếu AnyDoc gặp ngoại lệ.

- [ ] **Step 3: Chạy test và typecheck**

```powershell
npm --prefix .worktrees/markitdown-anydoc run lint
```

- [ ] **Step 4: Commit**

```powershell
git -C .worktrees/markitdown-anydoc add markitdown.ts tests/markitdown-parser.test.ts
git -C .worktrees/markitdown-anydoc commit -m "feat: integrate anydoc into markitdown backend parser"
```

---

### Task 3: Bổ sung 2 Chế độ (Fast vs AI) vào Endpoint API (`api/markitdown.ts`)

**Files:**
- Modify: `.worktrees/markitdown-anydoc/api/markitdown.ts`

**Interfaces:**
- Consumes: `req.body.mode?: "fast" | "ai"`
- Produces: Trả về trực tiếp Markdown khi `mode === "fast"`, hoặc đưa qua Gemini khi `mode === "ai"`.

- [ ] **Step 1: Cập nhật handler nhận `mode`**
  - Nếu `mode === "fast"` và `parseFile` trả về kết quả: Trả về ngay `{ success: true, markdown: rawMarkdown }`, bỏ qua bước gọi Gemini AI.
  - Nếu `mode === "ai"`: Đưa Markdown từ AnyDoc làm input context cho prompt chuyên biệt hóa LaTeX của Gemini.

- [ ] **Step 2: Xác minh typecheck**

```powershell
npm --prefix .worktrees/markitdown-anydoc run lint
```

- [ ] **Step 3: Commit**

```powershell
git -C .worktrees/markitdown-anydoc add api/markitdown.ts
git -C .worktrees/markitdown-anydoc commit -m "feat: add fast vs ai conversion mode in api/markitdown"
```

---

### Task 4: Gộp phần Tải lên (Đa tệp & Nhiều ảnh) trên Frontend (`MarkItDown.tsx`)

**Files:**
- Modify: `.worktrees/markitdown-anydoc/src/components/MarkItDown.tsx`

**Interfaces:**
- Consumes: Danh sách tệp `File[]` từ người dùng (hỗ trợ cả tài liệu và nhiều ảnh trong cùng một dropzone).
- Produces: Hàng đợi `chunks` xử lý tuần tự từng file/ảnh hoặc chia trang PDF.

- [ ] **Step 1: Hợp nhất Tab chuyển đổi**
  - Giảm còn 2 tab: `Tài liệu & Hình ảnh` và `URL / YouTube`.
  - Input file hỗ trợ `multiple` và các định dạng: `.pdf, .docx, .doc, .xlsx, .pptx, image/*`.

- [ ] **Step 2: Cập nhật state quản lý danh sách tệp chờ**
  - Cho phép người dùng xem danh sách các tệp đã chọn, có nút xóa từng tệp hoặc xóa tất cả trước khi bắt đầu.
  - Nút "Bắt đầu chuyển đổi" kích hoạt hàng đợi tuần tự.

- [ ] **Step 3: Kiểm tra giao diện và typecheck**

```powershell
npm --prefix .worktrees/markitdown-anydoc run lint
```

- [ ] **Step 4: Commit**

```powershell
git -C .worktrees/markitdown-anydoc add src/components/MarkItDown.tsx
git -C .worktrees/markitdown-anydoc commit -m "feat: unify file and image upload into single multi-file dropzone"
```

---

### Task 5: Thu gọn "Cấu hình Hàng đợi & Cắt trang" thành Accordion 1 hàng & Thêm Switch Mode

**Files:**
- Modify: `.worktrees/markitdown-anydoc/src/components/MarkItDown.tsx`

**Interfaces:**
- Consumes: `isQueueSettingsOpen: boolean`, `conversionMode: "fast" | "ai"`.
- Produces: Accordion 1 hàng có thể đóng mở mượt mà và bộ chuyển đổi chế độ Siêu tốc / AI Polish.

- [ ] **Step 1: Tạo Accordion 1 hàng**
  - Mặc định đóng (`isQueueSettingsOpen === false`).
  - Hàng tóm tắt hiển thị: icon, tiêu đề, tóm tắt thông số (`15 trang • 3.5s • Mốc trang ON`), và mũi tên Chevron.
  - Khi click: Mở rộng vùng điều khiển với animation trượt mượt mà.

- [ ] **Step 2: Thêm bộ chọn Chế độ Chuyển đổi (Mode Selector)**
  - Thêm Toggle chọn: **⚡ Siêu tốc** vs **✨ AI Math Polish**.
  - Truyền `mode` vào payload gửi tới `/api/markitdown`.

- [ ] **Step 3: Chạy lint và build kiểm tra toàn bộ worktree**

```powershell
npm --prefix .worktrees/markitdown-anydoc run lint
npm --prefix .worktrees/markitdown-anydoc run build
```

- [ ] **Step 4: Commit**

```powershell
git -C .worktrees/markitdown-anydoc add src/components/MarkItDown.tsx
git -C .worktrees/markitdown-anydoc commit -m "feat: make queue settings collapsible accordion and add mode selector"
```

---

### Task 6: Bàn giao Kiểm thử & Chờ phê duyệt Tích hợp

- [ ] **Step 1: Khởi động preview/dev server từ worktree để người dùng trải nghiệm thực tế trên trình duyệt**
- [ ] **Step 2: Báo cáo kết quả kiểm thử, danh sách commit trên nhánh `feature/markitdown-anydoc-upgrade`**
- [ ] **Step 3: Chờ người dùng nghiệm thu và chỉ tiến hành tích hợp vào `main` khi có lệnh trực tiếp**

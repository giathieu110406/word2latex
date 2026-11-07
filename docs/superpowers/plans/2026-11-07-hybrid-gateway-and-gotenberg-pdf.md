# Hybrid Gateway & Gotenberg High-Fidelity PDF Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai kiến trúc Hybrid Gateway (Vercel + VPS Cloud) và tích hợp Gotenberg Docker Microservice để biên dịch các định dạng Office (Word, PowerPoint, Excel) sang PDF vector 100% sắc nét (chuẩn in ấn "Save As", selectable text, không bị vỡ hạt như screenshot) với tốc độ cao (1-2s).

**Architecture:** Frontend (Vite SPA) và Lightweight API chạy trên Vercel Edge/Serverless. Backend Docker container trên VPS chạy kèm Gotenberg microservice (`gotenberg/gotenberg:8`) trên mạng nội bộ. Client tải file Office lên API backend, backend stream trực tiếp sang Gotenberg LibreOffice engine để nhận luồng PDF vector native và trả về ngay cho trình duyệt.

**Tech Stack:** Docker, Docker Compose, Gotenberg 8 (LibreOffice + Chromium headless), Express.js, Node.js 22, TypeScript, pdf-lib, Vite, React 19.

**Spec:** [docs/superpowers/specs/2026-11-07-hybrid-gateway-and-gotenberg-pdf-design.md](file:///C:/Users/Giath/OneDrive/Tài%20liệu/Thư%20mục%20mới/Antigravity/projects/word2latex/docs/superpowers/specs/2026-11-07-hybrid-gateway-and-gotenberg-pdf-design.md)

## Global Constraints
- Bảo toàn tính tương thích ngược: Giữ cơ chế Fallback nếu không có kết nối internet hoặc Gotenberg container tạm thời offline.
- Tốc độ xử lý: Sử dụng cơ chế in-memory streaming (Buffer / FormData stream), tuyệt đối không ghi file rác xuống ổ cứng VPS.
- Chuẩn chất lượng: File PDF kết quả phải là PDF vector (văn bản chọn và bôi đen được, hình ảnh giữ nguyên độ phân giải gốc).
- Tuân thủ quy tắc Conventional Commits cho từng task.

---

### Task 1: Thiết lập Docker Compose Stack cho VPS (Gotenberg 8 + App)

**Files:**
- Create: `docker-compose.yml`
- Modify: `Dockerfile`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `gotenberg/gotenberg:8` Docker image
- Produces: Mạng nội bộ kết nối `app` và `gotenberg:3000` với biến môi trường `GOTENBERG_URL=http://gotenberg:3000`

- [ ] **Step 1: Khởi tạo file cấu hình `docker-compose.yml`**
  - Định nghĩa 2 services: `app` (Word2LaTeX build từ `Dockerfile`) và `gotenberg` (`gotenberg/gotenberg:8`).
  - Thiết lập port 3000 cho Gotenberg (chỉ expose nội bộ trong bridge network `word2latex-net`).
  - Thiết lập healthcheck cho Gotenberg tại `http://localhost:3000/health`.
  - Cấu hình memory limit và restart policy `unless-stopped`.

- [ ] **Step 2: Cập nhật `Dockerfile` để tương thích cấu trúc mạng VPS**
  - Đảm bảo biến môi trường `GOTENBERG_URL` được định nghĩa mặc định hoặc truyền qua Docker Compose.
  - Cập nhật `.env.example` với các tham số: `GOTENBERG_URL=http://gotenberg:3000`.

- [ ] **Step 3: Kiểm tra cấu hình Docker Compose**
  - Chạy `docker compose config` (hoặc kiểm tra cú pháp yaml) để đảm bảo không có lỗi cú pháp.

---

### Task 2: Backend API `/api/convert-office-to-pdf` & Gotenberg Client

**Files:**
- Create: `server/gotenberg-client.ts`
- Create: `api/convert-office-to-pdf.ts`
- Modify: `index.ts:25-70`
- Test: `tests/office-pdf-conversion.test.ts`

**Interfaces:**
- Consumes: Buffer file Office (`.docx`, `.pptx`, `.xlsx`, `.odt`, `.rtf`) và tên file từ HTTP request body
- Produces: `POST /api/convert-office-to-pdf` trả về `application/pdf` binary stream

- [ ] **Step 1: Viết Unit Test cho Gotenberg Client & API endpoint**
  - Tạo `tests/office-pdf-conversion.test.ts` kiểm tra:
    - Xử lý nhận dạng định dạng file từ filename và MIME type.
    - Xử lý khi Gotenberg trả về PDF hợp lệ (mock hoặc live check).
    - Xử lý lỗi graceful (khi file không hợp lệ hoặc Gotenberg service không phản hồi).
  - Chạy test: `node --import tsx --test tests/office-pdf-conversion.test.ts` (kỳ vọng: test fail vì chưa có file).

- [ ] **Step 2: Hiện thực `server/gotenberg-client.ts`**
  - Hàm `convertOfficeDocumentWithGotenberg(fileBuffer: Buffer, fileName: string): Promise<Buffer>`:
    - Đóng gói file vào `FormData` theo chuẩn Gotenberg LibreOffice API.
    - Gửi request `POST ${GOTENBERG_URL}/forms/libreoffice/convert`.
    - Trả về `Buffer` của file PDF kết quả.
    - Bắt lỗi timeout và trả về message rõ ràng.

- [ ] **Step 3: Hiện thực handler `api/convert-office-to-pdf.ts` và đăng ký vào `index.ts`**
  - Nhận request (hỗ trợ multipart form data hoặc JSON base64).
  - Kiểm tra xác thực (Firebase Auth) tương tự các route khác.
  - Gọi `convertOfficeDocumentWithGotenberg`.
  - Gắn header `Content-Type: application/pdf` và `Content-Disposition`.
  - Đăng ký route vào Express tại `index.ts`.

- [ ] **Step 4: Chạy lại test suite để xác minh**
  - Chạy `node --import tsx --test tests/office-pdf-conversion.test.ts` để kiểm tra toàn bộ assertions.

---

### Task 3: Tái cấu trúc Frontend Office-to-PDF (`src/utils/office-to-pdf.ts` & `src/components/PdfEditorWorkspace.tsx`)

**Files:**
- Modify: `src/utils/office-to-pdf.ts`
- Modify: `src/components/PdfEditorWorkspace.tsx:750-785`

**Interfaces:**
- Consumes: File người dùng upload (`File` object) trong trình duyệt
- Produces: `ArrayBuffer` PDF vector sắc nét trả về cho `PdfEditorWorkspace`

- [ ] **Step 1: Cập nhật `src/utils/office-to-pdf.ts`**
  - Thêm hàm `convertOfficeFileViaBackend(file: File, onProgress?: (pct: number) => void): Promise<ArrayBuffer>`:
    - Gửi file trực tiếp qua `FormData` tới `/api/convert-office-to-pdf` (kèm Firebase ID token nếu có).
    - Cập nhật progress bar theo thời gian thực (upload -> processing -> download).
  - Thay thế logic cũ:
    - Mặc định: Gọi `convertOfficeFileViaBackend` để sinh PDF vector 100% chuẩn in ấn từ Gotenberg.
    - Fallback: Nếu backend offline hoặc request thất bại, tự động chuyển sang Fallback nhẹ `pdf-lib` (extract text) kèm thông báo cho người dùng.
    - Loại bỏ hoàn toàn sự phụ thuộc vào `html2canvas-pro` (vốn gây rasterize vỡ hạt và lag CPU).

- [ ] **Step 2: Cập nhật `src/components/PdfEditorWorkspace.tsx`**
  - Điều chỉnh hàm import file để gọi quy trình mới cho cả Word (`.docx`, `.doc`), PowerPoint (`.pptx`, `.ppt`) và Excel (`.xlsx`, `.xls`).
  - Hiển thị thông báo trạng thái "Đang biên dịch PDF vector chất lượng cao..." trên tiến trình.

- [ ] **Step 3: Kiểm tra biên dịch TypeScript frontend**
  - Chạy `npm run lint` (`tsc --noEmit`) để đảm bảo không có lỗi type.

---

### Task 4: Cấu hình Vercel Rewrites & Điều phối Môi trường (Hybrid Routing)

**Files:**
- Modify: `vercel.json`
- Modify: `.env.example`
- Modify: `vite.config.ts` (nếu cần proxy cho local dev)

**Interfaces:**
- Consumes: Request từ client trên Vercel
- Produces: Tự động route hoặc cấu hình endpoint VPS cho các tác vụ biên dịch nặng

- [ ] **Step 1: Cập nhật `vercel.json`**
  - Cấu hình serverless function timeout / memory phù hợp cho `api/convert-office-to-pdf.ts`.
  - Thiết lập rewrites hoặc fallback headers để cho phép client gọi endpoint VPS trực tiếp khi chạy Hybrid mode.

- [ ] **Step 2: Cập nhật biến môi trường Frontend & Backend**
  - Khai báo `VITE_VPS_API_URL` trong `.env.example` (dùng khi Frontend deploy độc lập trên Vercel gọi trực tiếp VPS domain).
  - Khai báo `GOTENBERG_URL` cho Backend Express trên VPS.

---

### Task 5: Kiểm chứng Toàn diện & Build Test (Verification)

**Files:**
- Test: Toàn bộ test suite (`npm run test:word`, `npm run test:latex`, `npm run test:parser`, test mới)
- Build: `npm run build`

- [ ] **Step 1: Chạy toàn bộ Test Suites hiện hữu và mới**
  - `npm run test:parser`
  - `npm run test:word`
  - `npm run test:latex`
  - `node --import tsx --test tests/office-pdf-conversion.test.ts`

- [ ] **Step 2: Chạy Production Build**
  - `npm run build` (kiểm tra cả Vite frontend build và esbuild server bundle).

- [ ] **Step 3: Xác minh chất lượng PDF đầu ra**
  - Đảm bảo file PDF sinh ra từ Gotenberg là PDF vector thực thụ (text có thể copy/search, ảnh giữ nguyên DPI, bảng biểu chuẩn).

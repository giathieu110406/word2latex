# Autonomous MarkItDown Dispatcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế điều phối tự động (Autonomous Dispatcher) cho MarkItDown: Tự động phát hiện tài liệu thuần text để đưa sang AnyDoc (siêu tốc 10ms, 0đ); tự động phát hiện tài liệu có ảnh/scan để đưa sang Xiaomi-OCR-0 trên VPS bóc tách thị giác, sau đó chuyển sang Gemini 3.5 Flash-Lite chuẩn hóa LaTeX và giải phóng tải VPS ngay lập tức.

**Architecture:** Smart Document Inspector phân tích nhị phân tệp trong < 5ms. Nếu không có ảnh/scan, AnyDoc xử lý native tức thì. Nếu có ảnh/scan, gửi sang Xiaomi-OCR-0 microservice trên VPS (0.8B Vision Model), sau đó chuyển tiếp kết quả thô sang Gemini 3.5 Flash-Lite trên đám mây để chuẩn hóa công thức LaTeX và xuất kết quả, tối ưu hóa triệt để tài nguyên VPS.

**Tech Stack:** Node.js 22, TypeScript, Express, JSZip, AnyDoc, Python FastAPI, Docker Compose, Xiaomi-OCR-0 (0.8B), Gemini 3.5 Flash-Lite API.

**Spec:** [docs/superpowers/specs/2026-11-07-autonomous-markitdown-dispatcher-design.md](file:///C:/Users/Giath/OneDrive/Tài%20liệu\Thư%20mục%20mới\Antigravity\projects\word2latex\docs\superpowers\specs\2026-11-07-autonomous-markitdown-dispatcher-design.md)

## Global Constraints
- Zero-Downtime Fallback: Nếu container Xiaomi-OCR-0 trên VPS chưa bật hoặc gặp lỗi, hệ thống phải tự động fallback sang Gemini Multimodal mà không báo lỗi ra người dùng.
- Tốc độ bộ quét nhị phân: Quá trình kiểm tra ảnh/scan trong file phải hoàn thành dưới 5 mili-giây trên RAM.
- Tiết kiệm tải VPS: Xiaomi-OCR-0 chỉ làm nhiệm vụ bóc tách thị giác, không giữ kết nối lâu; Gemini 3.5 Flash-Lite gánh toàn bộ phần sinh text và format LaTeX.
- Tuân thủ quy chuẩn Conventional Commits cho từng task.

---

### Task 1: Bộ Quét Nhanh Tài Liệu (`server/document-inspector.ts`) & Unit Test

**Files:**
- Create: `server/document-inspector.ts`
- Test: `tests/document-inspector.test.ts`

**Interfaces:**
- Consumes: Buffer, MIME type, filename
- Produces: `inspectDocumentMedia(buffer: Buffer, mimeType: string, filename: string): Promise<DocumentInspectionResult>`
  - `hasImagesOrScan: boolean`
  - `reason: 'image_file' | 'docx_embedded_media' | 'docx_pure_text' | 'pdf_contains_images' | 'pdf_pure_text' | 'pdf_scanned_no_text' | 'pure_tabular_text' | 'multimedia'`

- [ ] **Step 1: Viết Unit Test cho `server/document-inspector.ts`**
  - Tạo `tests/document-inspector.test.ts` kiểm thử:
    - Nhận diện file ảnh (`.png`, `.jpg`, `.webp`) $\rightarrow$ `hasImagesOrScan === true`.
    - Nhận diện file bảng tính/text (`.xlsx`, `.csv`, `.txt`) $\rightarrow$ `hasImagesOrScan === false`.
    - Nhận diện DOCX không có thư mục `word/media/` $\rightarrow$ `hasImagesOrScan === false`.
    - Nhận diện DOCX có thư mục `word/media/` $\rightarrow$ `hasImagesOrScan === true`.
    - Nhận diện PDF scan (không có text) hoặc PDF có ảnh $\rightarrow$ `hasImagesOrScan === true`.
  - Chạy test kiểm chứng: `node --import tsx --test tests/document-inspector.test.ts` (kỳ vọng: test fail vì chưa có file).

- [ ] **Step 2: Hiện thực `server/document-inspector.ts`**
  - Sử dụng JSZip để kiểm tra thư mục `word/media/` hoặc thẻ `<w:drawing>` đối với DOCX.
  - Sử dụng regex kiểm tra `/Image` và text layer đối với PDF.
  - Đảm bảo thời gian chạy dưới 5ms.

- [ ] **Step 3: Chạy lại test suite để xác minh**
  - `node --import tsx --test tests/document-inspector.test.ts`

---

### Task 2: Xiaomi-OCR-0 Client & Cấu hình Docker VPS

**Files:**
- Create: `server/xiaomi-ocr-client.ts`
- Create: `server/xiaomi-ocr/Dockerfile`
- Create: `server/xiaomi-ocr/server.py`
- Create: `server/xiaomi-ocr/requirements.txt`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Test: `tests/xiaomi-ocr-client.test.ts`

**Interfaces:**
- Consumes: `Buffer` ảnh/tài liệu từ request
- Produces: `callXiaomiOcr(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string | null>`

- [ ] **Step 1: Viết Unit Test cho `server/xiaomi-ocr-client.ts`**
  - Viết test kiểm tra URL resolution, health check, và cơ chế gracefully fallback về `null` khi server offline.
  - Chạy: `node --import tsx --test tests/xiaomi-ocr-client.test.ts`.

- [ ] **Step 2: Hiện thực `server/xiaomi-ocr-client.ts`**
  - Kết nối tới `XIAOMI_OCR_URL` (mặc định `http://xiaomi-ocr:8000`).
  - Gửi FormData tới endpoint `/ocr/document`.
  - Bắt lỗi timeout (15s) và trả về `null` nếu có lỗi để kích hoạt Fallback.

- [ ] **Step 3: Khởi tạo Docker Scaffolding cho Xiaomi-OCR-0**
  - Tạo `server/xiaomi-ocr/server.py` với FastAPI cung cấp endpoint `/health` và `POST /ocr/document`.
  - Cập nhật `docker-compose.yml` thêm service `xiaomi-ocr`.
  - Cập nhật `.env.example` với `XIAOMI_OCR_URL=http://xiaomi-ocr:8000`.

---

### Task 3: Tái Cấu Trúc Điều Phối Tự Động trong `api/markitdown.ts`

**Files:**
- Modify: `api/markitdown.ts`
- Modify: `markitdown.ts`

**Interfaces:**
- Consumes: Request POST từ client
- Produces: Markdown hoàn thiện được phân luồng tự động (AnyDoc vs Xiaomi-OCR-0 + Gemini Flash-Lite)

- [ ] **Step 1: Tích hợp Smart Document Inspector vào `api/markitdown.ts`**
  - Khi nhận file upload: chạy `inspectDocumentMedia(buffer, safeMime, resolvedFileName)`.
  - **Nếu `hasImagesOrScan === false`**:
    - Gọi AnyDoc xử lý native.
    - Trả ngay lập tức kết quả Markdown (0 token, phản hồi trong 10-20ms).
  - **Nếu `hasImagesOrScan === true`**:
    - Thử gọi `callXiaomiOcr(buffer, resolvedFileName, safeMime)`.
    - Nếu Xiaomi-OCR trả về text thô: chuyển text sang Gemini 3.5 Flash-Lite với prompt chuẩn hóa LaTeX và trả về kết quả (VPS được giải phóng ngay lập tức).
    - Nếu Xiaomi-OCR offline / bận: tự động fallback gửi trực tiếp `inlineData` sang Gemini Multimodal.

- [ ] **Step 2: Cập nhật `package.json` với scripts test mới**
  - Thêm `"test:inspector": "node --import tsx --test tests/document-inspector.test.ts"`.
  - Thêm `"test:xiaomi": "node --import tsx --test tests/xiaomi-ocr-client.test.ts"`.

---

### Task 4: Kiểm Chứng Toàn Diện & Build Verification

**Files:**
- Test: Toàn bộ test suite hiện hữu và mới
- Build: `npm run build`

- [ ] **Step 1: Chạy toàn bộ test suites**
  - `npm run test:inspector`
  - `npm run test:xiaomi`
  - `npm run test:office-pdf`
  - `npm run test:parser`
  - `npm run test:word`
  - `npm run test:latex`

- [ ] **Step 2: Chạy TypeCheck & Production Build**
  - `npm run lint` (`tsc --noEmit`)
  - `npm run build`

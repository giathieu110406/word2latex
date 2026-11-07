import { withActivity } from '../server/activity.js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { parseFile, parseUrl } from "../markitdown.js";
import { verifyAuthAndApproval } from '../server/auth-guard.js';
import { normalizeMarkdownMath } from '../src/utils/markdown-math.js';
import { loadGenAISDK, generateContentWithRetry } from '../server/gemini-client.js';
import { inspectDocumentMedia } from '../server/document-inspector.js';
import { callXiaomiOcr } from '../server/xiaomi-ocr-client.js';

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  epub: "application/epub+zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp3: "audio/mp3",
  wav: "audio/wav",
  mp4: "video/mp4",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
};

function resolveSafeMimeType(filename: string, incomingMime?: string): string {
  if (incomingMime && incomingMime !== "application/octet-stream" && incomingMime.includes("/")) {
    return incomingMime;
  }
  const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || incomingMime || "application/octet-stream";
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Xác thực token và trạng thái tài khoản trước khi xử lý
  const authCheck = (req as any).verifiedActivityAuth || await verifyAuthAndApproval(req);
  if (!authCheck.authorized) {
    return res.status(authCheck.status).json({ error: authCheck.error });
  }

  try {
    const { 
      type, 
      fileData, 
      fileBase64, 
      mimeType, 
      fileName, 
      filename, 
      url, 
      mode = "ai" 
    } = req.body || {};

    const base64Data = fileData || fileBase64;
    const resolvedFileName = fileName || filename || "";
    const conversionMode: "fast" | "ai" = mode === "fast" ? "fast" : "ai";

    let rawText = "";
    let inlineParts: any[] = [];

    // Xử lý dữ liệu đầu vào
    if (type === "text" || type === "rawText" || (!base64Data && !url && req.body.rawText)) {
      rawText = (req.body.rawText || req.body.text || req.body.content || "").trim();
      if (!rawText) {
        return res.status(400).json({ error: "Nội dung văn bản để AI chuẩn hóa không được rỗng" });
      }
      if (conversionMode === "fast") {
        return res.json({ success: true, markdown: rawText });
      }
    } else if (type === "url" && url) {
      const extracted = await parseUrl(url);
      if (!extracted) {
        return res.status(400).json({ error: "Không thể trích xuất nội dung từ liên kết URL" });
      }
      rawText = extracted;

      // CHẾ ĐỘ SIÊU TỐC: Trả về Markdown ngay lập tức
      if (conversionMode === "fast") {
        return res.json({ success: true, markdown: rawText });
      }
    } else if (type === "file" && base64Data) {
      const safeMime = resolveSafeMimeType(resolvedFileName, mimeType);
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const fileBuffer = Buffer.from(cleanBase64, 'base64');

      // 1. Quét nhanh cấu trúc tệp (< 5ms)
      const inspection = await inspectDocumentMedia(fileBuffer, safeMime, resolvedFileName);

      // Nhánh 1: Tệp thuần text (Không có ảnh, không có scan)
      // Tự động phân loại vào Siêu tốc với AnyDoc (0 token, 0 GPU, phản hồi ngay lập tức)
      if (!inspection.hasImagesOrScan) {
        const extracted = await parseFile(base64Data, safeMime, resolvedFileName, "fast");
        if (extracted && extracted.trim().length > 0) {
          return res.json({
            success: true,
            markdown: extracted,
            routedTo: 'anydoc_fast_pure_text',
            reason: inspection.reason,
          });
        }
      }

      // Nhánh 2: Tệp có hình ảnh, đồ thị, sơ đồ hoặc là scan
      // Phân loại vào AI Math Polish:
      // Tầng 1: Đưa sang Xiaomi-OCR-0 trên VPS bóc tách thị giác
      let xiaomiRawText: string | null = null;
      try {
        xiaomiRawText = await callXiaomiOcr(fileBuffer, resolvedFileName, safeMime);
      } catch (ocrErr) {
        console.warn('[MarkItDown] Xiaomi-OCR VPS gặp sự cố, kích hoạt fallback sang Gemini:', ocrErr);
      }

      if (xiaomiRawText) {
        // Xiaomi-OCR-0 đã bóc tách xong thị giác, đưa rawText sang Gemini 3.5 Flash-Lite để chuẩn hóa LaTeX
        rawText = xiaomiRawText;
      } else {
        // Fallback an toàn: nếu Xiaomi-OCR trên VPS không khả dụng, gửi trực tiếp sang Gemini Multimodal
        const extracted = await parseFile(base64Data, safeMime, resolvedFileName, conversionMode);
        if (extracted) {
          rawText = extracted;
        } else {
          inlineParts = [{
            inlineData: {
              mimeType: safeMime,
              data: cleanBase64,
            },
          }];
        }
      }
    } else {
      return res.status(400).json({ error: "Tham số yêu cầu không hợp lệ" });
    }

    // Nạp Gemini SDK và gọi AI chuẩn hóa LaTeX
    await loadGenAISDK();

    const contents: any = {
      parts: [
        { 
          text: `Chuyển đổi toàn bộ nội dung tài liệu, hình ảnh, âm thanh hoặc video này thành định dạng Markdown chuẩn xác cao. Nếu là tệp âm thanh hoặc video, hãy lắng nghe và chép lại đầy đủ nội dung lời thoại cùng cấu trúc đề mục. Giữ nguyên toàn bộ cấu trúc tiêu đề, bảng biểu, công thức toán học/hóa học, danh sách và trật tự logic.

QUY TẮC CÔNG THỨC TOÁN (LATEX):
- Công thức nội dòng (inline): dùng $...$ (ví dụ: $x_1 \\ge 0$).
- Công thức khối (display math): BẮT BUỘC dùng $$...$$ trên CÁC DÒNG RIÊNG BIỆT.
  Ví dụ chuẩn:
  $$
  \\begin{cases}
  2x_1 + 14x_2 + 2x_3 \\le 0 \\\\
  x_1 - 7x_2 - x_3 \\le 1
  \\end{cases}
  $$
- TUYỆT ĐỐI KHÔNG viết dính liền $$ với cú pháp môi trường (như $$\\begin{cases} hoặc \\end{cases}$$).
- Các khối $$ liên tiếp nhau bắt buộc phải cách nhau bằng ít nhất 1 dòng trống.

Tuyệt đối không thêm lời chào, nhận xét hay giải thích bên ngoài. Chỉ trả về nội dung Markdown thuần túy.` 
        }
      ]
    };

    if (rawText) {
      contents.parts.push({ text: `\n\n[DỮ LIỆU TÀI LIỆU]:\n${rawText}` });
    }
    if (inlineParts.length > 0) {
      contents.parts.push(...inlineParts);
    }

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash-lite",
      contents: contents
    }, 2, 1000, ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"]);

    const markdownText = response?.text?.trim();
    if (!markdownText || markdownText === "undefined") {
      throw new Error("Không thể trích xuất Markdown từ tài liệu này qua AI");
    }

    const cleanedMarkdown = normalizeMarkdownMath(markdownText);
    return res.json({ success: true, markdown: cleanedMarkdown });

  } catch (error: any) {
    console.error("MarkItDown error:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi xử lý tài liệu" });
  }
}
 

export default withActivity(handler, () => 'MarkItDown AI');

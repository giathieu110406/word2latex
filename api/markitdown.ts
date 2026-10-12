import { withActivity } from '../server/activity.js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { parseFile, parseUrl } from "../markitdown.js";
import { verifyAuthAndApproval } from '../server/auth-guard.js';
import { normalizeMarkdownMath } from '../src/utils/markdown-math.js';

// Khởi tạo dynamic import để tránh crash runtime (Lỗi 500) trên Vercel
let GoogleGenAISDK: any = null;
let aiClient: any = null;

async function loadGenAISDK() {
  if (!GoogleGenAISDK) {
    const sdk = await import('@google/genai');
    GoogleGenAISDK = sdk.GoogleGenAI;
  }
}

function cleanApiKey(key: string | undefined): string {
  if (!key) return "";
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function getAiClient(): any {
  const primaryKey = cleanApiKey(process.env.GEMINI_API_KEY);

  if (!primaryKey) {
    throw new Error("Không thể kết nối đến Trợ lý AI. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
  }

  if (!aiClient) {
    aiClient = new GoogleGenAISDK({
      apiKey: primaryKey,
    });
  }
  return aiClient;
}

async function generateContentWithRetry(params: any, retries = 2, delay = 1000, overrideModelsToTry?: string[]) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Không thể kết nối đến Trợ lý AI. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
  }

  let lastError: any = null;
  let firstImportantError: any = null;
  
  // Chuỗi fallback: Đặt 3.5-flash-lite lên đầu để phản hồi siêu tốc (<1.5s), 3.8-flash, và 2.5-flash cực kỳ ổn định
  const modelsToTry = overrideModelsToTry || [
    params.model || "gemini-3.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash"
  ].filter((value, index, self) => self.indexOf(value) === index && value);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const model of modelsToTry) {
      try {
        console.log(`[Gemini API] Đang gửi yêu cầu bằng model: ${model} (Lần thử ${attempt}/${retries})`);
        const aiInstance = getAiClient();

        const response: any = await aiInstance.models.generateContent({
          ...params,
          model: model
        });
        
        // Đảm bảo kết quả trả về có chứa nội dung văn bản
        const extracted = response?.text 
          || response?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("")
          || "";

        if (extracted && extracted.trim().length > 0) {
          return { ...response, text: extracted };
        } else {
          console.warn(`[Gemini API] Model ${model} trả về nội dung rỗng, chuyển model tiếp theo...`);
        }
      } catch (error: any) {
        lastError = error;
        if (!firstImportantError && error.status !== 404) {
          firstImportantError = error;
        }
        console.warn(`[Gemini API] Model ${model} gặp lỗi (${error.status || error.message || error}), đang đổi sang model tiếp theo...`);
        
        if (
          error.message?.includes("API_KEY_INVALID") ||
          error.message?.includes("cấu hình GEMINI_API_KEY") ||
          error.status === 403 ||
          error.status === 401
        ) {
          break; 
        }
        
        // Với mọi lỗi khác (429, 503, 500, overload, v.v.), lập tức chuyển model tiếp theo trong chuỗi fallback
        continue;
      }
    }
    
    if (attempt < retries) {
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`[Gemini API] Tất cả các model đều gặp sự cố ở lần thử ${attempt}. Đang chờ ${waitTime}ms trước khi thử lại...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  let finalError = firstImportantError || lastError || new Error("Tất cả các model đều thất bại sau nhiều lần thử.");
  if (finalError.status === 429 || (finalError.message && (finalError.message.includes("quota") || finalError.message.includes("Quota")))) {
    finalError.message = "Đã hết hạn mức sử dụng API Gemini (Quota Exceeded) hoặc API Key không hỗ trợ gói miễn phí. Vui lòng kiểm tra lại tài khoản Google AI Studio của bạn.";
  } else if (finalError.status === 404 || (finalError.message && finalError.message.includes("not found"))) {
    finalError.message = "Model AI không được hỗ trợ bởi API Key này (404 Not Found). Vui lòng kiểm tra lại cấu hình.";
  } else if (finalError.status === 503 || (finalError.message && (finalError.message.includes("high demand") || finalError.message.includes("overloaded") || finalError.message.includes("UNAVAILABLE")))) {
    finalError.message = "Hệ thống AI đang quá tải (503). Vui lòng thử lại sau ít phút.";
  }
  throw finalError;
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
      const extracted = await parseFile(base64Data, mimeType || "", resolvedFileName, conversionMode);
      
      // CHẾ ĐỘ SIÊU TỐC (FAST MODE)
      if (conversionMode === "fast") {
        if (extracted && extracted.trim().length > 0) {
          // Trả về ngay lập tức, 0 AI token, phản hồi tức thì
          return res.json({ success: true, markdown: extracted });
        } else {
          // Trường hợp tệp hình ảnh hoặc PDF scan không có text layer
          return res.status(400).json({ 
            error: "Không thể trích xuất văn bản ở chế độ Siêu tốc (file hình ảnh hoặc PDF scan cần nhận diện OCR). Vui lòng chuyển sang chế độ 'AI Math Polish' để xử lý." 
          });
        }
      }

      // CHẾ ĐỘ AI MATH POLISH (MẶC ĐỊNH)
      if (extracted) {
        rawText = extracted;
      } else {
        inlineParts = [{
          inlineData: {
            mimeType: mimeType || 'application/octet-stream',
            data: base64Data
          }
        }];
      }
    } else {
      return res.status(400).json({ error: "Tham số yêu cầu không hợp lệ" });
    }

    // Nạp Gemini SDK và gọi AI chuẩn hóa LaTeX
    await loadGenAISDK();

    const contents: any = {
      parts: [
        { 
          text: `Chuyển đổi toàn bộ nội dung tài liệu này thành định dạng Markdown chuẩn xác cao. Giữ nguyên toàn bộ cấu trúc tiêu đề, bảng biểu biểu đồ, công thức toán học/hóa học, danh sách và trật tự logic.

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

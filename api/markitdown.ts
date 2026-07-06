import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { parseFile, parseUrl } from "../markitdown.ts";

let aiClient: GoogleGenAI | null = null;
let aiBackupClient: GoogleGenAI | null = null;

function getAiClient(useBackup = false): GoogleGenAI {
  const primaryKey = process.env.GEMINI_API_KEY;
  const backupKey = process.env.keyduphongrk1104 || process.env.GEMINI_API_KEY_BACKUP || "AQ.Ab8RN6JaJXwFc-5EVoSbWQ7RwD_7qoLOc7DWrkM-7HdSM5cVgg";

  if (useBackup || !primaryKey) {
    if (!aiBackupClient) {
      aiBackupClient = new GoogleGenAI({
        apiKey: backupKey,
      });
    }
    return aiBackupClient;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: primaryKey,
    });
  }
  return aiClient;
}

async function generateContentWithRetry(params: any, retries = 3, delay = 1500, overrideModelsToTry?: string[]) {
  if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY_BACKUP && !process.env.keyduphongrk1104) {
    throw new Error("Không thể kết nối đến Trợ lý AI Canvas. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
  }

  let lastError: any = null;
  let firstImportantError: any = null;
  
  const modelsToTry = overrideModelsToTry || [
    params.model || "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro"
  ].filter((value, index, self) => self.indexOf(value) === index && value);
  
  const keysToTry = [false, true]; 
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const useBackup of keysToTry) {
      for (const model of modelsToTry) {
        try {
          console.log(`[Gemini API] Đang gửi yêu cầu bằng model: ${model} (Key dự phòng: ${useBackup ? 'Có' : 'Không'}, Lần thử ${attempt}/${retries})`);
          const aiInstance = getAiClient(useBackup);
          const response = await aiInstance.models.generateContent({
            ...params,
            model: model
          });
          return response;
        } catch (error: any) {
          lastError = error;
          if (!firstImportantError && error.status !== 404) {
             firstImportantError = error;
          }
          console.warn(`[Gemini API] Thử nghiệm model ${model} (Key dự phòng: ${useBackup ? 'Có' : 'Không'}) thất bại:`, error.message || error);
          
          if (
            error.message?.includes("API_KEY_INVALID") ||
            error.message?.includes("cấu hình GEMINI_API_KEY") ||
            error.status === 403 ||
            error.status === 401
          ) {
            break; 
          }
          
          if (error.status === 429 || error.status === 503 || (error.message && (error.message.includes("quota") || error.message.includes("Quota") || error.message.includes("high demand") || error.message.includes("overloaded")))) {
             continue;
          }
        }
      }
    }
    
    if (attempt < retries) {
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`[Gemini API] Tất cả các model và key đều tạm thời không khả dụng ở lần thử ${attempt}. Đang chờ ${waitTime}ms trước khi thử lại...`);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, fileData, mimeType, fileName, url } = req.body;
    let rawText = "";
    let inlineParts: any[] = [];

    if (type === "url" && url) {
      const extracted = await parseUrl(url);
      if (!extracted) {
        return res.status(400).json({ error: "Could not extract content from URL" });
      }
      rawText = extracted;
    } else if (type === "file" && fileData) {
      const extracted = await parseFile(fileData, mimeType, fileName || "");
      if (extracted) {
        rawText = extracted;
      } else {
        inlineParts = [{
          inlineData: {
            mimeType: mimeType || 'application/octet-stream',
            data: fileData
          }
        }];
      }
    } else {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    const contents: any = {
      parts: [
        { text: "Convert to markdown. Do not add any conversational text. Return only the markdown text." }
      ]
    };

    if (rawText) {
      contents.parts.push({ text: `\n\n[CONTENT]:\n${rawText}` });
    }
    if (inlineParts.length > 0) {
      contents.parts.push(...inlineParts);
    }

    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: contents
    }, 3, 1500, ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]);

    return res.json({ success: true, markdown: response.text });

  } catch (error: any) {
    console.error("MarkItDown error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
}
 
// server/gemini-client.ts
// Helper dùng chung cho Gemini SDK trên các endpoint backend

let GoogleGenAISDK: any = null;
let aiClient: any = null;
export let Type: any = null;

export function cleanApiKey(key: string | undefined): string {
  return key?.replace(/^["']|["']$/g, '').trim() || "";
}

export async function loadGenAISDK() {
  if (!GoogleGenAISDK) {
    const sdk = await import('@google/genai');
    GoogleGenAISDK = sdk.GoogleGenAI;
    Type = sdk.Type;
  }
  return GoogleGenAISDK;
}

export function getAiClient(): any {
  const primaryKey = cleanApiKey(process.env.GEMINI_API_KEY);
  if (!primaryKey) {
    throw new Error("Không thể kết nối đến Trợ lý AI. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAISDK({ apiKey: primaryKey });
  }
  return aiClient;
}

export const DEFAULT_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

export async function generateContentWithRetry(
  params: any,
  retries = 2,
  delay = 1000,
  overrideModelsOrConfig?: string[] | { temperature?: number; topK?: number; topP?: number },
  generationConfig?: { temperature?: number; topK?: number; topP?: number }
) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Không thể kết nối đến Trợ lý AI. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
  }

  await loadGenAISDK();

  let overrideModelsToTry: string[] | undefined;
  let genConfig = generationConfig;

  if (Array.isArray(overrideModelsOrConfig)) {
    overrideModelsToTry = overrideModelsOrConfig;
  } else if (overrideModelsOrConfig && typeof overrideModelsOrConfig === "object") {
    genConfig = overrideModelsOrConfig;
  }

  const mergedParams = { ...params };
  if (genConfig) {
    mergedParams.config = {
      ...params.config,
      ...genConfig,
    };
  }

  const modelsToTry = overrideModelsToTry || [
    params.model,
    ...DEFAULT_FALLBACK_CHAIN
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  let lastError: any = null;
  let firstImportantError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const model of modelsToTry) {
      try {
        console.log(`[Gemini API] Đang gửi yêu cầu bằng model: ${model} (Lần thử ${attempt}/${retries})`);
        const aiInstance = getAiClient();
        const response: any = await aiInstance.models.generateContent({
          ...mergedParams,
          model,
        });

        const extracted = response?.text 
          || response?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("")
          || "";

        if (extracted && extracted.trim().length > 0) {
          return { ...response, text: extracted };
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
          throw error;
        }
        continue;
      }
    }

    if (attempt < retries) {
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  const finalError = firstImportantError || lastError || new Error("Tất cả các model đều thất bại sau nhiều lần thử.");
  if (finalError.status === 429 || finalError.message?.includes("quota") || finalError.message?.includes("Quota")) {
    finalError.message = "Đã hết hạn mức sử dụng API Gemini (Quota Exceeded). Vui lòng thử lại sau hoặc kiểm tra API Key.";
  } else if (finalError.status === 503 || finalError.message?.includes("high demand") || finalError.message?.includes("overloaded")) {
    finalError.message = "Hệ thống AI đang quá tải (503). Vui lòng thử lại sau ít phút.";
  }
  throw finalError;
}

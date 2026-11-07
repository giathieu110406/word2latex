/**
 * Xiaomi-OCR-0 Microservice Client
 * Handles fast vision-language OCR for images, scanned documents, tables, and math equations.
 */

export function getXiaomiOcrUrl(): string {
  const envUrl = process.env.XIAOMI_OCR_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://xiaomi-ocr:8000';
}

export async function checkXiaomiOcrHealth(): Promise<boolean> {
  const url = getXiaomiOcrUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Gửi tệp ảnh hoặc PDF sang Xiaomi-OCR-0 Microservice trên VPS để bóc tách thị giác.
 * Nếu dịch vụ chưa sẵn sàng hoặc gặp lỗi, hàm tự động trả về `null`
 * để kích hoạt cơ chế Fallback sang Gemini Multimodal mà không làm gián đoạn người dùng.
 */
export async function callXiaomiOcr(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = 'application/octet-stream'
): Promise<string | null> {
  const url = getXiaomiOcrUrl();
  const endpoint = `${url}/ocr/document`;

  const formData = new FormData();
  const fileBlob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', fileBlob, fileName);

  const controller = new AbortController();
  const timeoutMs = 30_000; // 30s timeout cho VPS OCR
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[Xiaomi-OCR Client] VPS trả về lỗi HTTP ${res.status}, kích hoạt fallback sang Gemini.`);
      return null;
    }

    const data: any = await res.json();
    const extractedText = data?.markdown || data?.text || '';

    if (extractedText && typeof extractedText === 'string' && extractedText.trim().length > 0) {
      return extractedText.trim();
    }

    return null;
  } catch (err: any) {
    console.warn(`[Xiaomi-OCR Client] Không thể kết nối tới Xiaomi-OCR-0 (${url}): ${err?.message || err}. Kích hoạt fallback sang Gemini.`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

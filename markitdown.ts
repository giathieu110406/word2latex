import * as mammoth from "mammoth";
import * as xlsx from 'xlsx';
import * as cheerio from 'cheerio';
import { YoutubeTranscript } from 'youtube-transcript';
import { 
  toMarkdownBytes, 
  formatFromBytes, 
  formatFromExtension, 
  formatFromPath, 
} from '@firecrawl/anydoc';
import type { Format } from '@firecrawl/anydoc';

/**
 * Bản đồ ánh xạ MIME types thông dụng sang AnyDoc Format
 */
function resolveFormatFromMime(mimeType: string): Format | null {
  const lower = mimeType.toLowerCase();
  if (lower.includes('wordprocessingml') || lower.includes('msword')) return 'docx' as Format;
  if (lower.includes('spreadsheetml') || lower.includes('excel')) return 'xlsx' as Format;
  if (lower.includes('presentationml') || lower.includes('powerpoint')) return 'pptx' as Format;
  if (lower.includes('pdf')) return 'pdf' as Format;
  if (lower.includes('csv')) return 'csv' as Format;
  if (lower.includes('opendocument.text')) return 'odt' as Format;
  if (lower.includes('opendocument.spreadsheet')) return 'ods' as Format;
  if (lower.includes('opendocument.presentation')) return 'odp' as Format;
  if (lower.includes('rtf')) return 'rtf' as Format;
  if (lower.includes('epub')) return 'epub' as Format;
  return null;
}

/**
 * Xác định Format tối ưu nhất từ Tên tệp, MIME type và Magic bytes
 */
function detectDocumentFormat(buffer: Buffer, mimeType: string, filename: string): Format | null {
  // 1. Kiểm tra từ đường dẫn / tên file
  if (filename) {
    const fromPath = formatFromPath(filename);
    if (fromPath) return fromPath;
    
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex !== -1) {
      const ext = filename.slice(dotIndex);
      const fromExt = formatFromExtension(ext);
      if (fromExt) return fromExt;
    }
  }

  // 2. Kiểm tra từ magic bytes của buffer
  try {
    const fromBytes = formatFromBytes(buffer);
    if (fromBytes) return fromBytes;
  } catch {
    // Bỏ qua lỗi formatFromBytes nếu buffer rỗng hoặc bất thường
  }

  // 3. Kiểm tra từ MIME type
  if (mimeType) {
    const fromMime = resolveFormatFromMime(mimeType);
    if (fromMime) return fromMime;
  }

  return null;
}

export async function parseFile(
  base64Data: string, 
  mimeType: string, 
  filename: string,
  mode?: "fast" | "ai"
): Promise<string | null> {
  const buffer = Buffer.from(base64Data, 'base64');
  const lowerName = (filename || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  // 1. Xử lý trực tiếp plain text và markdown (AnyDoc không nhận format 'txt')
  if (
    lowerMime.startsWith('text/plain') || 
    lowerMime.startsWith('text/markdown') || 
    lowerName.endsWith('.txt') || 
    lowerName.endsWith('.md')
  ) {
    try {
      const text = buffer.toString('utf-8').trim();
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }

  // 2. Nhận diện định dạng cho AnyDoc
  const detectedFormat = detectDocumentFormat(buffer, lowerMime, lowerName);

  // 3. Ưu tiên phân tích bằng AnyDoc nếu định dạng được hỗ trợ
  if (detectedFormat) {
    try {
      const markdown = await toMarkdownBytes(buffer, detectedFormat);
      if (markdown && markdown.trim().length > 0) {
        return markdown.trim();
      }
    } catch (anydocError: any) {
      // Nếu PDF scan cần OCR, trả về null để Gemini Vision xử lý ở chế độ AI
      if (anydocError?.code === 'needsOcr') {
        console.warn(`[AnyDoc] File PDF '${filename}' có trang dạng ảnh cần OCR (needsOcr).`);
        return null;
      }
      console.warn(`[AnyDoc] Phân tích thất bại trên file '${filename}', kích hoạt fallback:`, anydocError?.message || anydocError);
    }
  }

  // 4. Cơ chế Fallback Dự phòng
  try {
    // 4.1. Fallback về Mammoth cho Word (.docx, .doc)
    if (
      lowerMime.includes('wordprocessingml') || 
      lowerMime.includes('msword') || 
      lowerName.endsWith('.docx') || 
      lowerName.endsWith('.doc')
    ) {
      const mammothResult = await mammoth.extractRawText({ buffer });
      if (mammothResult?.value && mammothResult.value.trim().length > 0) {
        return mammothResult.value.trim();
      }
    }

    // 4.2. Fallback về XLSX cho Bảng tính (.xlsx, .xls, .csv)
    if (
      lowerMime.includes('spreadsheetml') || 
      lowerMime.includes('excel') || 
      lowerMime.includes('csv') ||
      lowerName.endsWith('.xlsx') || 
      lowerName.endsWith('.xls') || 
      lowerName.endsWith('.csv')
    ) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        text += `\n--- Sheet: ${sheetName} ---\n`;
        const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        text += csv;
      });
      if (text.trim().length > 0) {
        return text.trim();
      }
    }
  } catch (fallbackError) {
    console.error(`[Fallback] Lỗi xử lý fallback trên file '${filename}':`, fallbackError);
  }

  // Trả về null cho PDF scan hoặc các định dạng hình ảnh/audio/video để Gemini Multimodal xử lý
  return null;
}

export async function parseUrl(url: string): Promise<string | null> {
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      return transcript.map(t => t.text).join(' ');
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const html = await res.text();
      const $ = cheerio.load(html);
      
      // Remove scripts, styles
      $('script, style, noscript').remove();
      
      // Basic extraction
      return $('body').text().replace(/\s+/g, ' ').trim();
    }
  } catch (err) {
    console.error("Parse URL error:", err);
  }
  return null;
}
 
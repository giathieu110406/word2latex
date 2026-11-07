import { PDFDocument, PageSizes, StandardFonts, rgb } from 'pdf-lib';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import html2canvas from 'html2canvas-pro';

export function isWordFile(fileName: string, mimeType?: string): boolean {
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  return (
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    lowerMime.includes('wordprocessingml') ||
    lowerMime.includes('msword')
  );
}

export function isPowerPointFile(fileName: string, mimeType?: string): boolean {
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  return (
    lowerName.endsWith('.pptx') ||
    lowerName.endsWith('.ppt') ||
    lowerMime.includes('presentationml') ||
    lowerMime.includes('powerpoint')
  );
}

export function isExcelFile(fileName: string, mimeType?: string): boolean {
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  return (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerMime.includes('spreadsheetml') ||
    lowerMime.includes('excel')
  );
}

export function isOfficeFile(fileName: string, mimeType?: string): boolean {
  return isWordFile(fileName, mimeType) || isPowerPointFile(fileName, mimeType) || isExcelFile(fileName, mimeType);
}

/**
 * Trích xuất text thô an toàn từ binary buffer (.doc cũ hoặc .ppt cũ)
 */
function extractRawStringsFromBinary(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer);
  const result: string[] = [];
  let current = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Ký tự hiển thị được (ASCII + xuống dòng/tab cơ bản)
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      current += String.fromCharCode(b);
    } else {
      if (current.trim().length >= 4) {
        result.push(current.trim());
      }
      current = '';
    }
  }
  if (current.trim().length >= 4) {
    result.push(current.trim());
  }

  // Lọc bớt các chuỗi rác header Office (Root Entry, CompObj, etc.)
  return result.filter(
    (str) =>
      !str.startsWith('\x01') &&
      !str.includes('Root Entry') &&
      !str.includes('WordDocument') &&
      !str.includes('SummaryInformation') &&
      !str.includes('DocumentSummaryInformation')
  );
}

/**
 * Fallback tạo PDF thuần bằng pdf-lib (sử dụng khi chạy ngoài browser như Node test)
 */
async function createFallbackPdf(
  pagesText: string[][],
  pageSize: [number, number] = [PageSizes.A4[0], PageSizes.A4[1]],
  isSlide = false
): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let pIdx = 0; pIdx < pagesText.length; pIdx++) {
    const lines = pagesText[pIdx];
    const page = pdfDoc.addPage(pageSize);
    const { width, height } = page.getSize();

    let y = height - 48;
    const margin = 48;
    const maxW = width - margin * 2;

    // Header / Title trang
    page.drawText(isSlide ? `Slide ${pIdx + 1}` : `Page ${pIdx + 1}`, {
      x: margin,
      y,
      size: isSlide ? 18 : 12,
      font: fontBold,
      color: rgb(0.15, 0.23, 0.36),
    });
    y -= isSlide ? 30 : 20;

    for (const line of lines) {
      if (y < 48) break;
      const cleanLine = line.replace(/[^\x20-\x7E]/g, ' ').slice(0, 90);
      page.drawText(cleanLine, {
        x: margin,
        y,
        size: isSlide ? 14 : 10,
        font,
        color: rgb(0.2, 0.25, 0.3),
        maxWidth: maxW,
      });
      y -= isSlide ? 22 : 14;
    }
  }

  if (pdfDoc.getPageCount() === 0) {
    pdfDoc.addPage(pageSize);
  }

  const bytes = await pdfDoc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// ============================================================================
// CHUYỂN ĐỔI WORD (.DOCX, .DOC) SANG PDF
// ============================================================================

interface WordPageSetup {
  widthPt: number;
  heightPt: number;
  marginTopPt: number;
  marginRightPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
}

/**
 * Đọc kích thước trang thực tế (<w:pgSz>) và lề trang (<w:pgMar>) từ word/document.xml
 * Đơn vị trong OOXML Word là Twips (1/20 của 1 point, tức 1 inch = 1440 twips = 72 pt)
 */
async function extractWordPageSetup(arrayBuffer: ArrayBuffer): Promise<WordPageSetup> {
  const defaultSetup: WordPageSetup = {
    widthPt: PageSizes.A4[0], // 595.28
    heightPt: PageSizes.A4[1], // 841.89
    marginTopPt: 42,
    marginRightPt: 48,
    marginBottomPt: 42,
    marginLeftPt: 48,
  };

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.files['word/document.xml'];
    if (!docXmlFile) return defaultSetup;

    const xml = await docXmlFile.async('text');
    const pgSzMatch = xml.match(/<w:pgSz\b([^>]*)\/?>/i);
    if (pgSzMatch) {
      const attrs = pgSzMatch[1];
      const wMatch = attrs.match(/\bw:w="(\d+)"/i) || attrs.match(/\bw="(\d+)"/i);
      const hMatch = attrs.match(/\bw:h="(\d+)"/i) || attrs.match(/\bh="(\d+)"/i);
      const orientMatch = attrs.match(/\bw:orient="([^"]+)"/i) || attrs.match(/\borient="([^"]+)"/i);

      if (wMatch && hMatch) {
        let wPt = Math.round((parseInt(wMatch[1], 10) / 20) * 100) / 100;
        let hPt = Math.round((parseInt(hMatch[1], 10) / 20) * 100) / 100;
        if (orientMatch && orientMatch[1].toLowerCase() === 'landscape' && wPt < hPt) {
          [wPt, hPt] = [hPt, wPt];
        }
        if (wPt >= 144 && hPt >= 144) {
          defaultSetup.widthPt = wPt;
          defaultSetup.heightPt = hPt;
        }
      }
    }

    const pgMarMatch = xml.match(/<w:pgMar\b([^>]*)\/?>/i);
    if (pgMarMatch) {
      const attrs = pgMarMatch[1];
      const topM = attrs.match(/\bw:top="(\d+)"/i) || attrs.match(/\btop="(\d+)"/i);
      const rightM = attrs.match(/\bw:right="(\d+)"/i) || attrs.match(/\bright="(\d+)"/i);
      const bottomM = attrs.match(/\bw:bottom="(\d+)"/i) || attrs.match(/\bbottom="(\d+)"/i);
      const leftM = attrs.match(/\bw:left="(\d+)"/i) || attrs.match(/\bleft="(\d+)"/i);

      if (topM) defaultSetup.marginTopPt = Math.min(96, Math.max(24, Math.round(parseInt(topM[1], 10) / 20)));
      if (rightM) defaultSetup.marginRightPt = Math.min(96, Math.max(24, Math.round(parseInt(rightM[1], 10) / 20)));
      if (bottomM) defaultSetup.marginBottomPt = Math.min(96, Math.max(24, Math.round(parseInt(bottomM[1], 10) / 20)));
      if (leftM) defaultSetup.marginLeftPt = Math.min(96, Math.max(24, Math.round(parseInt(leftM[1], 10) / 20)));
    }
  } catch {
    // Fallback to A4 if not a valid zip or no document.xml
  }

  return defaultSetup;
}

/**
 * Chuyển đổi ArrayBuffer sang chuỗi Base64 an toàn không gây tràn call stack
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, len)) as unknown as number[]
    );
  }
  return btoa(binary);
}

/**
 * Thử biên dịch sang PDF vector chất lượng cao (100% sắc nét chuẩn in ấn)
 * thông qua Gotenberg LibreOffice Engine trên Backend / VPS
 */
async function tryConvertViaBackend(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer | null> {
  // Bỏ qua nếu chạy trong môi trường không có window/fetch (như Node.js test runner)
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return null;
  }

  try {
    onProgress?.(25);
    const base64 = arrayBufferToBase64(arrayBuffer);
    onProgress?.(45);

    // Sử dụng authFetch an toàn nếu có
    let fetchFn: typeof fetch = fetch;
    try {
      const apiModule = await import('./api-client');
      if (apiModule?.authFetch) {
        fetchFn = apiModule.authFetch;
      }
    } catch {
      // Fallback sang native fetch nếu không load được api-client
    }

    const apiBase =
      typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_VPS_API_URL
        ? (import.meta as any).env.VITE_VPS_API_URL.replace(/\/+$/, '')
        : '';
    const endpoint = `${apiBase}/api/convert-office-to-pdf`;

    onProgress?.(60);
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileBase64: base64,
      }),
    });

    if (res.ok) {
      onProgress?.(90);
      const pdfBuffer = await res.arrayBuffer();
      if (pdfBuffer && pdfBuffer.byteLength > 0) {
        console.log(`[Office-to-PDF] Biên dịch thành công PDF vector chất lượng cao cho ${fileName} qua Gotenberg Backend.`);
        onProgress?.(100);
        return pdfBuffer;
      }
    } else {
      console.warn(`[Office-to-PDF] Backend trả về mã lỗi ${res.status}, chuyển sang fallback client-side.`);
    }
  } catch (err) {
    console.warn('[Office-to-PDF] Không thể kết nối tới Gotenberg Backend, chuyển sang fallback client-side:', err);
  }

  return null;
}

export async function convertWordToPdfBuffer(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(5);
  const arrayBuffer =
    fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  onProgress?.(15);

  // 1. Thử biên dịch qua Gotenberg Backend (Vector PDF 100% chuẩn in ấn sắc nét)
  const backendPdf = await tryConvertViaBackend(arrayBuffer, fileName, onProgress);
  if (backendPdf) {
    return backendPdf;
  }

  const isDocx = fileName.toLowerCase().endsWith('.docx');
  const pageSetup = isDocx
    ? await extractWordPageSetup(arrayBuffer)
    : {
        widthPt: PageSizes.A4[0],
        heightPt: PageSizes.A4[1],
        marginTopPt: 42,
        marginRightPt: 48,
        marginBottomPt: 42,
        marginLeftPt: 48,
      };

  let htmlContent = '';
  let rawTextFallback: string[] = [];

  if (isDocx) {
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      htmlContent = result.value;
      if (result.messages && result.messages.length > 0) {
        console.warn('Mammoth warnings for', fileName, result.messages);
      }
    } catch {
      rawTextFallback = extractRawStringsFromBinary(arrayBuffer);
    }
  } else {
    // File .doc cũ
    rawTextFallback = extractRawStringsFromBinary(arrayBuffer);
  }
  onProgress?.(30);

  // Trường hợp môi trường không có DOM (như Unit test Node.js)
  if (typeof document === 'undefined') {
    const textLines = htmlContent
      ? htmlContent.replace(/<[^>]+>/g, '\n').split('\n').filter((l) => l.trim().length > 0)
      : rawTextFallback;

    const pages: string[][] = [];
    const linesPerPage = pageSetup.widthPt > pageSetup.heightPt ? 24 : 35;
    for (let i = 0; i < textLines.length; i += linesPerPage) {
      pages.push(textLines.slice(i, i + linesPerPage));
    }
    if (pages.length === 0) pages.push(['(Tài liệu trống)']);
    return createFallbackPdf(pages, [pageSetup.widthPt, pageSetup.heightPt], false);
  }

  // Quy đổi từ PDF pt (72 DPI) sang CSS px (96 DPI): 1 pt = 4/3 px
  const PT_TO_PX = 4 / 3;
  const pageWidthPx = Math.round(pageSetup.widthPt * PT_TO_PX);
  const pageHeightPx = Math.round(pageSetup.heightPt * PT_TO_PX);
  const padTopPx = Math.round(pageSetup.marginTopPt * PT_TO_PX);
  const padRightPx = Math.round(pageSetup.marginRightPt * PT_TO_PX);
  const padBottomPx = Math.round(pageSetup.marginBottomPt * PT_TO_PX);
  const padLeftPx = Math.round(pageSetup.marginLeftPt * PT_TO_PX);
  const maxPageContentHeight = Math.max(200, pageHeightPx - padTopPx - padBottomPx);

  // Môi trường Browser: Render DOM + html2canvas-pro + pdf-lib
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = `${pageWidthPx}px`;
  container.style.height = `${pageHeightPx}px`;
  container.style.zIndex = '-9999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const styleBlock = `
    <style>
      .w2l-office-word-page h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 12px; margin-top: 14px; }
      .w2l-office-word-page h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 10px; margin-top: 12px; }
      .w2l-office-word-page h3 { font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 8px; margin-top: 10px; }
      .w2l-office-word-page p { margin-bottom: 10px; text-align: justify; word-break: break-word; }
      .w2l-office-word-page table { width: 100%; border-collapse: collapse; margin: 12px 0; table-layout: auto; }
      .w2l-office-word-page th, .w2l-office-word-page td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 13px; word-break: break-word; }
      .w2l-office-word-page th { background-color: #f1f5f9; font-weight: 600; }
      .w2l-office-word-page ul, .w2l-office-word-page ol { padding-left: 24px; margin-bottom: 10px; }
      .w2l-office-word-page img { max-width: 100%; max-height: ${Math.round(maxPageContentHeight * 0.75)}px; width: auto; height: auto; object-fit: contain; margin: 8px 0; border-radius: 4px; }
    </style>
  `;

  try {
    const pageWrapper = createWordPageContainer(
      pageWidthPx,
      pageHeightPx,
      padTopPx,
      padRightPx,
      padBottomPx,
      padLeftPx,
      styleBlock,
      true
    );

    const contentDiv = document.createElement('div');
    if (htmlContent) {
      contentDiv.innerHTML = htmlContent;
    } else {
      contentDiv.innerHTML = rawTextFallback
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('');
    }
    pageWrapper.appendChild(contentDiv);
    container.appendChild(pageWrapper);

    // Chờ toàn bộ ảnh nhúng trong nội dung Word load xong để tính đúng offsetHeight và không bị mất ảnh
    await waitForImagesLoaded(contentDiv);

    // Phân trang tự động theo chiều cao thực tế của khung trang
    const childNodes = Array.from(contentDiv.children) as HTMLElement[];
    const pagesElements: HTMLElement[] = [];
    let currentPageDiv = createWordPageContainer(
      pageWidthPx,
      pageHeightPx,
      padTopPx,
      padRightPx,
      padBottomPx,
      padLeftPx,
      styleBlock,
      false
    );
    let currentHeight = 0;

    if (childNodes.length === 0) {
      currentPageDiv.innerHTML += `<p style="color: #64748b; font-style: italic;">(Tài liệu "${escapeHtml(fileName)}" không có nội dung văn bản hiển thị)</p>`;
      pagesElements.push(currentPageDiv);
    } else {
      for (const node of childNodes) {
        const rect = node.getBoundingClientRect();
        const nodeHeight = Math.ceil(rect.height || node.offsetHeight || 28) + 10;
        if (currentHeight + nodeHeight > maxPageContentHeight && currentHeight > 0) {
          pagesElements.push(currentPageDiv);
          currentPageDiv = createWordPageContainer(
            pageWidthPx,
            pageHeightPx,
            padTopPx,
            padRightPx,
            padBottomPx,
            padLeftPx,
            styleBlock,
            false
          );
          currentHeight = 0;
        }
        currentPageDiv.appendChild(node.cloneNode(true));
        currentHeight += nodeHeight;
      }
      if (currentPageDiv.children.length > 1) {
        pagesElements.push(currentPageDiv);
      }
    }

    container.innerHTML = '';
    const pdfDoc = await PDFDocument.create();

    const totalPages = pagesElements.length;
    // Scale 2.0 cho độ nét ~ 192 DPI (Retina sharp), giảm xuống 1.65 nếu tài liệu > 25 trang để đảm bảo tốc độ
    const renderScale = totalPages > 25 ? 1.65 : 2.0;

    for (let pIndex = 0; pIndex < totalPages; pIndex++) {
      const pageEl = pagesElements[pIndex];
      container.appendChild(pageEl);
      await waitForImagesLoaded(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: renderScale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      container.removeChild(pageEl);

      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const imgBytes = await fetch(imgDataUrl).then((r) => r.arrayBuffer());
      const embeddedImg = await pdfDoc.embedJpg(imgBytes);

      const pdfPage = pdfDoc.addPage([pageSetup.widthPt, pageSetup.heightPt]);
      pdfPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: pageSetup.widthPt,
        height: pageSetup.heightPt,
      });

      const stepProgress = 35 + Math.round(((pIndex + 1) / totalPages) * 60);
      onProgress?.(Math.min(95, stepProgress));
    }

    const saved = await pdfDoc.save();
    onProgress?.(100);
    return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

function createWordPageContainer(
  widthPx: number,
  heightPx: number,
  padTopPx: number,
  padRightPx: number,
  padBottomPx: number,
  padLeftPx: number,
  styleHtml: string,
  isMeasurer = false
): HTMLElement {
  const page = document.createElement('div');
  page.style.width = `${widthPx}px`;
  if (isMeasurer) {
    page.style.minHeight = `${heightPx}px`;
  } else {
    page.style.height = `${heightPx}px`;
    page.style.overflow = 'hidden';
  }
  page.style.padding = `${padTopPx}px ${padRightPx}px ${padBottomPx}px ${padLeftPx}px`;
  page.style.boxSizing = 'border-box';
  page.style.backgroundColor = '#ffffff';
  page.style.color = '#1e293b';
  page.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  page.style.fontSize = '14px';
  page.style.lineHeight = '1.65';
  page.className = 'w2l-office-word-page';
  page.innerHTML = styleHtml;
  return page;
}

async function waitForImagesLoaded(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return;
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
          };
          img.addEventListener('load', done);
          img.addEventListener('error', done);
          setTimeout(done, 1500);
        })
    )
  );
}

// ============================================================================
// CHUYỂN ĐỔI POWERPOINT (.PPTX, .PPT) SANG PDF
// ============================================================================

interface PptxTextRun {
  text: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  colorHex?: string;
}

interface PptxParagraph {
  runs: PptxTextRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  level?: number;
  isBullet?: boolean;
}

interface PptxShapeBox {
  type: 'text' | 'image';
  xEmu?: number;
  yEmu?: number;
  wEmu?: number;
  hEmu?: number;
  isTitlePlaceholder?: boolean;
  fillColorHex?: string;
  paragraphs?: PptxParagraph[];
  imageUrl?: string;
}

interface SlideParsedData {
  title: string;
  paragraphs: string[];
  imageUrls: string[];
  bgImageUrl?: string;
  bgColorHex?: string;
  shapes: PptxShapeBox[];
  hasExactLayout: boolean;
}

const DEFAULT_THEME_COLORS: Record<string, string> = {
  dk1: '0F172A',
  tx1: '0F172A',
  lt1: 'FFFFFF',
  bg1: 'FFFFFF',
  dk2: '1E3A8A',
  tx2: '334155',
  lt2: 'F1F5F9',
  bg2: 'F8FAFC',
  accent1: '2563EB',
  accent2: 'EA580C',
  accent3: '64748B',
  accent4: 'EAB308',
  accent5: '0284C7',
  accent6: '16A34A',
};

function parseThemeColorsFromXml(themeXml: string): Record<string, string> {
  const map: Record<string, string> = { ...DEFAULT_THEME_COLORS };
  const keys = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  for (const key of keys) {
    const tagRegex = new RegExp(`<a:${key}\\b[^>]*>([\\s\\S]*?)<\\/a:${key}>`, 'i');
    const m = tagRegex.exec(themeXml);
    if (m) {
      const inner = m[1];
      const srgb = inner.match(/<a:srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/i);
      const sys = inner.match(/<a:sysClr\b[^>]*lastClr="([0-9A-Fa-f]{6})"/i);
      const hex = srgb?.[1] || sys?.[1];
      if (hex) {
        map[key] = hex.toUpperCase();
      }
    }
  }
  map.tx1 = map.dk1;
  map.bg1 = map.lt1;
  map.tx2 = map.dk2;
  map.bg2 = map.lt2;
  return map;
}

function extractColorFromXmlBlock(xmlBlock: string, themeColors: Record<string, string>): string | undefined {
  const srgb = xmlBlock.match(/<a:srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/i);
  if (srgb) return `#${srgb[1].toUpperCase()}`;

  const scheme = xmlBlock.match(/<a:schemeClr\b[^>]*val="([^"]+)"/i);
  if (scheme) {
    const key = scheme[1].toLowerCase();
    const mapped = themeColors[key] || DEFAULT_THEME_COLORS[key];
    if (mapped) return `#${mapped}`;
  }
  return undefined;
}

function isDarkHexColor(hex?: string): boolean {
  if (!hex) return false;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
}

export async function convertPowerPointToPdfBuffer(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(5);
  const arrayBuffer =
    fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  onProgress?.(15);

  // 1. Thử biên dịch qua Gotenberg Backend (Vector PDF 100% chuẩn in ấn sắc nét)
  const backendPdf = await tryConvertViaBackend(arrayBuffer, fileName, onProgress);
  if (backendPdf) {
    return backendPdf;
  }

  const isPptx = fileName.toLowerCase().endsWith('.pptx');
  const slides: SlideParsedData[] = [];

  // Mặc định 16:9 trong OOXML: 12192000 x 6858000 EMU (tương đương 960 x 540 px)
  let slideWidthEmu = 12192000;
  let slideHeightEmu = 6858000;

  if (isPptx) {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      // 1. Đọc kích thước gốc của slide từ ppt/presentation.xml (<p:sldSz cx="..." cy="..."/>)
      if (zip.files['ppt/presentation.xml']) {
        const presXml = await zip.files['ppt/presentation.xml'].async('text');
        const sldSzMatch = presXml.match(/<p:sldSz\b([^>]*)\/?>/i);
        if (sldSzMatch) {
          const cxMatch = sldSzMatch[1].match(/\bcx="(\d+)"/i);
          const cyMatch = sldSzMatch[1].match(/\bcy="(\d+)"/i);
          if (cxMatch && cyMatch) {
            const cx = parseInt(cxMatch[1], 10);
            const cy = parseInt(cyMatch[1], 10);
            if (cx > 100000 && cy > 100000) {
              slideWidthEmu = cx;
              slideHeightEmu = cy;
            }
          }
        }
      }

      // 2. Đọc bảng màu chủ đề từ ppt/theme/theme1.xml
      let themeColors = { ...DEFAULT_THEME_COLORS };
      const themeFile = Object.keys(zip.files).find((k) => /^ppt\/theme\/theme\d+\.xml$/i.test(k));
      if (themeFile && zip.files[themeFile]) {
        const themeXml = await zip.files[themeFile].async('text');
        themeColors = parseThemeColorsFromXml(themeXml);
      }

      // 3. Đọc nền mặc định từ slideMaster1.xml nếu có
      let masterBgColorHex: string | undefined;
      let masterBgImageUrl: string | undefined;
      const masterFile = 'ppt/slideMasters/slideMaster1.xml';
      const masterRelsFile = 'ppt/slideMasters/_rels/slideMaster1.xml.rels';
      if (zip.files[masterFile]) {
        const masterXml = await zip.files[masterFile].async('text');
        const masterBgMatch = masterXml.match(/<p:bg\b[\s\S]*?<\/p:bg>/i);
        if (masterBgMatch) {
          masterBgColorHex = extractColorFromXmlBlock(masterBgMatch[0], themeColors);
          const bgEmbed = masterBgMatch[0].match(/r:embed="([^"]+)"/i);
          if (bgEmbed && zip.files[masterRelsFile]) {
            const masterRelsXml = await zip.files[masterRelsFile].async('text');
            const target = getRelTargetById(masterRelsXml, bgEmbed[1]);
            if (target) {
              masterBgImageUrl = await loadZipMediaDataUrl(zip, target);
            }
          }
        }
      }

      // 4. Tìm tất cả các slide trong ppt/slides/slide{n}.xml
      const slideFileNames = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10);
          const numB = parseInt(b.replace(/\D/g, ''), 10);
          return numA - numB;
        });

      const mediaCache = new Map<string, string>();

      for (let i = 0; i < slideFileNames.length; i++) {
        const slideName = slideFileNames[i];
        const xmlText = await zip.files[slideName].async('text');

        const relsFileName = slideName.replace(
          /ppt\/slides\/slide(\d+)\.xml$/i,
          'ppt/slides/_rels/slide$1.xml.rels'
        );
        const relsXml = zip.files[relsFileName]
          ? await zip.files[relsFileName].async('text')
          : '';

        // Kiểm tra slideLayout tương ứng của slide để lấy nền hoặc hình trang trí từ Layout (nếu có)
        let layoutBgColorHex: string | undefined;
        let layoutBgImageUrl: string | undefined;
        if (relsXml) {
          const layoutTargetMatch = relsXml.match(
            /<Relationship\b[^>]*Type="[^"]*slideLayout"[^>]*Target="([^"]+)"/i
          );
          if (layoutTargetMatch) {
            const layoutPath = `ppt/${layoutTargetMatch[1].replace(/^\.\.\//, '')}`;
            const layoutRelsPath = layoutPath.replace(
              /ppt\/slideLayouts\/(slideLayout\d+\.xml)$/i,
              'ppt/slideLayouts/_rels/$1.rels'
            );
            if (zip.files[layoutPath]) {
              const layoutXml = await zip.files[layoutPath].async('text');
              const layoutBgMatch = layoutXml.match(/<p:bg\b[\s\S]*?<\/p:bg>/i);
              if (layoutBgMatch) {
                layoutBgColorHex = extractColorFromXmlBlock(layoutBgMatch[0], themeColors);
                const bgEmbed = layoutBgMatch[0].match(/r:embed="([^"]+)"/i);
                if (bgEmbed && zip.files[layoutRelsPath]) {
                  const layoutRelsXml = await zip.files[layoutRelsPath].async('text');
                  const target = getRelTargetById(layoutRelsXml, bgEmbed[1]);
                  if (target) {
                    layoutBgImageUrl = await loadZipMediaDataUrl(zip, target, mediaCache);
                  }
                }
              }
            }
          }
        }

        const parsedSlide = await parseSlideXmlWithLayout(
          xmlText,
          relsXml,
          zip,
          themeColors,
          mediaCache
        );

        if (!parsedSlide.bgImageUrl) {
          parsedSlide.bgImageUrl = layoutBgImageUrl || masterBgImageUrl;
        }
        if (!parsedSlide.bgColorHex) {
          parsedSlide.bgColorHex = layoutBgColorHex || masterBgColorHex;
        }

        slides.push(parsedSlide);
      }
    } catch (err) {
      console.warn('JSZip PPTX parse failed, falling back to raw extraction:', err);
    }
  }

  // Fallback nếu không đọc được slide từ PPTX hoặc là .ppt cũ
  if (slides.length === 0) {
    const rawStrings = extractRawStringsFromBinary(arrayBuffer);
    const chunkSize = 8;
    for (let i = 0; i < rawStrings.length; i += chunkSize) {
      const chunk = rawStrings.slice(i, i + chunkSize);
      slides.push({
        title: chunk[0] || `Slide ${i / chunkSize + 1}`,
        paragraphs: chunk.slice(1),
        imageUrls: [],
        shapes: [],
        hasExactLayout: false,
      });
    }
    if (slides.length === 0) {
      slides.push({
        title: fileName,
        paragraphs: ['(Tập tin trình chiếu không có nội dung văn bản)'],
        imageUrls: [],
        shapes: [],
        hasExactLayout: false,
      });
    }
  }

  // Tính kích thước chuẩn theo đúng tỷ lệ gốc từ EMU (neo chiều ngang cơ sở 960px để font chữ và bố cục chuẩn xác)
  const aspect = slideWidthEmu / Math.max(1, slideHeightEmu);
  const slideWidth = 960;
  const slideHeight = Math.round(slideWidth / aspect);

  // Trường hợp không có DOM (Node test)
  if (typeof document === 'undefined') {
    const pages = slides.map((s) => [s.title, ...s.paragraphs]);
    return createFallbackPdf(pages, [slideWidth, slideHeight], true);
  }

  // Môi trường Browser: Container đặt cố định ở góc viewport nhưng z-index âm
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = `${slideWidth}px`;
  container.style.height = `${slideHeight}px`;
  container.style.zIndex = '-9999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  // Độ nét Retina: Scale 2.0 (1920x1080 Full HD) cho bài dưới 35 slides, 1.65 cho bài lớn để vừa nét vừa nhanh
  const renderScale = slides.length > 35 ? 1.65 : 2.0;

  try {
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideEl = buildSlideDomElement(
        slide,
        i,
        slides.length,
        slideWidth,
        slideHeight,
        slideWidthEmu,
        slideHeightEmu
      );

      container.appendChild(slideEl);
      await waitForImagesLoaded(slideEl);

      const canvas = await html2canvas(slideEl, {
        scale: renderScale,
        useCORS: true,
        logging: false,
        backgroundColor: slide.bgColorHex || '#ffffff',
      });
      container.removeChild(slideEl);

      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const imgBytes = await fetch(imgDataUrl).then((r) => r.arrayBuffer());
      const embeddedImg = await pdfDoc.embedJpg(imgBytes);

      const pdfPage = pdfDoc.addPage([slideWidth, slideHeight]);
      pdfPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: slideWidth,
        height: slideHeight,
      });

      const slideProg = 20 + Math.round(((i + 1) / slides.length) * 75);
      onProgress?.(Math.min(96, slideProg));
    }

    const saved = await pdfDoc.save();
    onProgress?.(100);
    return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

async function loadZipMediaDataUrl(
  zip: JSZip,
  relTarget: string,
  cache?: Map<string, string>
): Promise<string | undefined> {
  const fullPath = `ppt/${relTarget.replace(/^\.\.\//, '').replace(/^\/?ppt\//, '')}`;
  if (cache && cache.has(fullPath)) {
    return cache.get(fullPath);
  }
  const fileObj = zip.files[fullPath];
  if (!fileObj) return undefined;
  const ext = fullPath.split('.').pop()?.toLowerCase() || 'png';
  // Bỏ qua các định dạng vector/metafile cũ không hỗ trợ trực tiếp bằng thẻ <img>
  if (ext === 'emf' || ext === 'wmf') return undefined;
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'gif'
      ? 'image/gif'
      : ext === 'svg'
      ? 'image/svg+xml'
      : ext === 'webp'
      ? 'image/webp'
      : 'image/png';
  const base64 = await fileObj.async('base64');
  const url = `data:${mime};base64,${base64}`;
  if (cache) cache.set(fullPath, url);
  return url;
}

/**
 * Xây dựng DOM cho 1 slide:
 * - Nếu slide có tọa độ hình học chuẩn từ OOXML (hasExactLayout): dựng đúng vị trí khung hình/chữ, màu sắc, cỡ chữ gốc
 * - Nếu là fallback (.ppt cũ hoặc shape không có tọa độ): dựng bố cục chuẩn rõ ràng, tự động tương phản màu chữ
 */
function buildSlideDomElement(
  slide: SlideParsedData,
  slideIdx: number,
  totalSlides: number,
  slideWidth: number,
  slideHeight: number,
  slideWidthEmu: number,
  slideHeightEmu: number
): HTMLElement {
  const slideEl = document.createElement('div');
  slideEl.style.width = `${slideWidth}px`;
  slideEl.style.height = `${slideHeight}px`;
  slideEl.style.boxSizing = 'border-box';
  slideEl.style.position = 'relative';
  slideEl.style.overflow = 'hidden';
  slideEl.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  const hasDarkBg = isDarkHexColor(slide.bgColorHex);
  const defaultTextColor = hasDarkBg ? '#F8FAFC' : '#0F172A';

  if (slide.bgColorHex) {
    slideEl.style.backgroundColor = slide.bgColorHex;
  } else {
    slideEl.style.backgroundColor = '#ffffff';
  }

  if (slide.bgImageUrl) {
    slideEl.style.backgroundImage = `url("${slide.bgImageUrl}")`;
    slideEl.style.backgroundSize = 'cover';
    slideEl.style.backgroundPosition = 'center';
  }

  // Nếu có tọa độ shapes thực tế từ PPTX XML
  if (slide.hasExactLayout && slide.shapes.length > 0) {
    // Kiểm tra xem có ảnh nền full-bleed (nằm ở lớp đầu tiên phủ > 80% diện tích slide) không
    let firstFullBleedImage = false;
    if (slide.shapes[0]?.type === 'image') {
      const s0 = slide.shapes[0];
      const wRatio = (s0.wEmu || 0) / slideWidthEmu;
      const hRatio = (s0.hEmu || 0) / slideHeightEmu;
      if (wRatio > 0.8 && hRatio > 0.8) {
        firstFullBleedImage = true;
      }
    }

    for (let sIdx = 0; sIdx < slide.shapes.length; sIdx++) {
      const shape = slide.shapes[sIdx];
      const leftPx =
        shape.xEmu !== undefined
          ? Math.round((shape.xEmu / slideWidthEmu) * slideWidth)
          : shape.isTitlePlaceholder
          ? 48
          : 48;
      const topPx =
        shape.yEmu !== undefined
          ? Math.round((shape.yEmu / slideHeightEmu) * slideHeight)
          : shape.isTitlePlaceholder
          ? 36
          : 120;
      const widthPx =
        shape.wEmu !== undefined && shape.wEmu > 0
          ? Math.round((shape.wEmu / slideWidthEmu) * slideWidth)
          : slideWidth - leftPx - 48;
      const heightPx =
        shape.hEmu !== undefined && shape.hEmu > 0
          ? Math.round((shape.hEmu / slideHeightEmu) * slideHeight)
          : slideHeight - topPx - 36;

      if (shape.type === 'image' && shape.imageUrl) {
        const imgBox = document.createElement('div');
        imgBox.style.position = 'absolute';
        imgBox.style.left = `${leftPx}px`;
        imgBox.style.top = `${topPx}px`;
        imgBox.style.width = `${widthPx}px`;
        imgBox.style.height = `${heightPx}px`;
        imgBox.style.zIndex = String(sIdx + 1);
        imgBox.style.overflow = 'hidden';
        imgBox.style.display = 'flex';
        imgBox.style.alignItems = 'center';
        imgBox.style.justifyContent = 'center';

        const img = document.createElement('img');
        img.src = shape.imageUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        const isFullSlideImg = widthPx >= slideWidth * 0.85 && heightPx >= slideHeight * 0.85;
        img.style.objectFit = isFullSlideImg ? 'cover' : 'contain';
        imgBox.appendChild(img);
        slideEl.appendChild(imgBox);
      } else if (shape.type === 'text' && shape.paragraphs && shape.paragraphs.length > 0) {
        const textBox = document.createElement('div');
        textBox.style.position = 'absolute';
        textBox.style.left = `${Math.max(0, leftPx)}px`;
        textBox.style.top = `${Math.max(0, topPx)}px`;
        textBox.style.width = `${Math.min(slideWidth - Math.max(0, leftPx), Math.max(80, widthPx))}px`;
        textBox.style.minHeight = `${Math.max(24, heightPx)}px`;
        textBox.style.maxHeight = `${Math.max(40, slideHeight - Math.max(0, topPx) - 8)}px`;
        textBox.style.zIndex = String(sIdx + 10);
        textBox.style.boxSizing = 'border-box';
        textBox.style.padding = shape.fillColorHex ? '10px 14px' : '4px 6px';
        textBox.style.display = 'flex';
        textBox.style.flexDirection = 'column';
        textBox.style.gap = '6px';
        textBox.style.wordBreak = 'break-word';

        if (shape.fillColorHex) {
          textBox.style.backgroundColor = shape.fillColorHex;
          textBox.style.borderRadius = '6px';
        }

        const boxHasDarkFill = isDarkHexColor(shape.fillColorHex) || ( !shape.fillColorHex && hasDarkBg );

        // Tính tổng ký tự trong khung để tự động co nhẹ font nếu nội dung quá dài tránh bị tràn cắt chữ
        const totalChars = shape.paragraphs.reduce(
          (sum, p) => sum + p.runs.reduce((rSum, r) => rSum + r.text.length, 0),
          0
        );
        const autoShrinkFactor = totalChars > 600 ? 0.78 : totalChars > 400 ? 0.88 : 1;

        for (const para of shape.paragraphs) {
          const pDiv = document.createElement('div');
          pDiv.style.textAlign = para.align || 'left';
          pDiv.style.lineHeight = shape.isTitlePlaceholder ? '1.25' : '1.42';
          pDiv.style.marginLeft = para.level ? `${para.level * 20}px` : '0px';

          const defaultFontSizePx = shape.isTitlePlaceholder ? 28 : 17;

          if (para.isBullet && !shape.isTitlePlaceholder) {
            pDiv.style.display = 'flex';
            pDiv.style.alignItems = 'baseline';
            pDiv.style.gap = '8px';

            const bulletSpan = document.createElement('span');
            bulletSpan.textContent = '•';
            bulletSpan.style.fontWeight = '700';
            bulletSpan.style.color =
              para.runs[0]?.colorHex ||
              (boxHasDarkFill || firstFullBleedImage ? '#FFFFFF' : '#2563EB');
            pDiv.appendChild(bulletSpan);
          }

          const contentContainer = document.createElement('span');
          for (const run of para.runs) {
            const span = document.createElement('span');
            span.textContent = run.text;
            const rawPx = run.fontSizePt ? Math.round(run.fontSizePt * 1.25) : defaultFontSizePx;
            const finalPx = Math.max(11, Math.min(54, Math.round(rawPx * autoShrinkFactor)));
            span.style.fontSize = `${finalPx}px`;
            if (run.bold || shape.isTitlePlaceholder) {
              span.style.fontWeight = '700';
            }
            if (run.italic) {
              span.style.fontStyle = 'italic';
            }
            if (run.colorHex) {
              span.style.color = run.colorHex;
            } else if (boxHasDarkFill) {
              span.style.color = '#FFFFFF';
            } else {
              span.style.color = defaultTextColor;
            }

            // Nếu chữ nằm đè trực tiếp lên ảnh nền hoặc ảnh full-bleed mà không có khung nền riêng,
            // thêm bóng đổ nhẹ tinh tế để chữ trắng hay chữ đen đều nổi bật sắc nét
            if ((slide.bgImageUrl || firstFullBleedImage) && !shape.fillColorHex) {
              const effectiveColor = span.style.color.toUpperCase();
              const isLightText =
                effectiveColor.includes('FFF') ||
                effectiveColor.includes('255, 255, 255') ||
                effectiveColor.includes('F8FAFC');
              span.style.textShadow = isLightText
                ? '0 1px 4px rgba(0,0,0,0.75)'
                : '0 1px 3px rgba(255,255,255,0.85)';
            }

            contentContainer.appendChild(span);
          }

          pDiv.appendChild(contentContainer);
          textBox.appendChild(pDiv);
        }

        slideEl.appendChild(textBox);
      }
    }

    return slideEl;
  }

  // Fallback Layout (dành cho .ppt cũ hoặc slide không có tọa độ hình học)
  slideEl.style.padding = '40px 52px';
  slideEl.style.display = 'flex';
  slideEl.style.flexDirection = 'column';
  slideEl.style.justifyContent = 'flex-start';
  if (!slide.bgImageUrl && !slide.bgColorHex) {
    slideEl.style.background = 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)';
  }

  const headerDiv = document.createElement('div');
  headerDiv.style.borderBottom = '2px solid #3b82f6';
  headerDiv.style.paddingBottom = '10px';
  headerDiv.style.marginBottom = '20px';
  headerDiv.style.display = 'flex';
  headerDiv.style.justifyContent = 'space-between';
  headerDiv.style.alignItems = 'baseline';

  const titleEl = document.createElement('h2');
  titleEl.style.fontSize = '25px';
  titleEl.style.fontWeight = '700';
  titleEl.style.color = hasDarkBg ? '#FFFFFF' : '#1e3a8a';
  titleEl.style.margin = '0';
  titleEl.textContent = slide.title || `Slide ${slideIdx + 1}`;
  headerDiv.appendChild(titleEl);

  const numEl = document.createElement('span');
  numEl.style.fontSize = '12px';
  numEl.style.fontWeight = '600';
  numEl.style.color = hasDarkBg ? '#CBD5E1' : '#64748b';
  numEl.textContent = `${slideIdx + 1} / ${totalSlides}`;
  headerDiv.appendChild(numEl);

  slideEl.appendChild(headerDiv);

  const bodyDiv = document.createElement('div');
  bodyDiv.style.display = 'flex';
  bodyDiv.style.gap = '24px';
  bodyDiv.style.flex = '1';
  bodyDiv.style.minHeight = '0';

  const textCol = document.createElement('div');
  textCol.style.flex = slide.imageUrls.length > 0 ? '1.3' : '1';
  textCol.style.display = 'flex';
  textCol.style.flexDirection = 'column';
  textCol.style.gap = '8px';

  for (const p of slide.paragraphs) {
    if (!p.trim()) continue;
    const pEl = document.createElement('div');
    pEl.style.fontSize = '15px';
    pEl.style.lineHeight = '1.55';
    pEl.style.color = defaultTextColor;
    pEl.style.display = 'flex';
    pEl.style.alignItems = 'flex-start';
    pEl.style.gap = '8px';

    const bullet = document.createElement('span');
    bullet.style.color = '#3b82f6';
    bullet.style.fontWeight = 'bold';
    bullet.textContent = '•';
    pEl.appendChild(bullet);

    const textSpan = document.createElement('span');
    textSpan.textContent = p;
    pEl.appendChild(textSpan);

    textCol.appendChild(pEl);
  }
  bodyDiv.appendChild(textCol);

  if (slide.imageUrls.length > 0) {
    const imgCol = document.createElement('div');
    imgCol.style.flex = '1';
    imgCol.style.display = 'flex';
    imgCol.style.flexWrap = 'wrap';
    imgCol.style.gap = '10px';
    imgCol.style.justifyContent = 'center';
    imgCol.style.alignItems = 'center';

    for (const url of slide.imageUrls.slice(0, 4)) {
      const img = document.createElement('img');
      img.src = url;
      img.style.maxWidth = slide.imageUrls.length > 1 ? '48%' : '100%';
      img.style.maxHeight = slide.imageUrls.length > 1 ? '180px' : '340px';
      img.style.objectFit = 'contain';
      img.style.borderRadius = '6px';
      imgCol.appendChild(img);
    }
    bodyDiv.appendChild(imgCol);
  }

  slideEl.appendChild(bodyDiv);
  return slideEl;
}

/**
 * Phân tích đầy đủ cấu trúc hình học, bảng màu, ảnh và văn bản của Slide OOXML
 */
async function parseSlideXmlWithLayout(
  xmlText: string,
  relsXml: string,
  zip: JSZip,
  themeColors: Record<string, string>,
  mediaCache: Map<string, string>
): Promise<SlideParsedData> {
  const paragraphsFlat: string[] = [];
  let title = '';
  const imageUrls: string[] = [];
  let bgImageUrl: string | undefined;
  let bgColorHex: string | undefined;
  const shapes: PptxShapeBox[] = [];

  // 1. Phân tích nền riêng của slide (<p:bg>)
  const bgBlockMatch = xmlText.match(/<p:bg\b[\s\S]*?<\/p:bg>/i);
  if (bgBlockMatch) {
    bgColorHex = extractColorFromXmlBlock(bgBlockMatch[0], themeColors);
    const bgEmbedMatch = bgBlockMatch[0].match(/r:embed="([^"]+)"/i);
    if (bgEmbedMatch && relsXml) {
      const target = getRelTargetById(relsXml, bgEmbedMatch[1]);
      if (target) {
        bgImageUrl = await loadZipMediaDataUrl(zip, target, mediaCache);
      }
    }
  }

  // 2. Duyệt tuần tự các phần tử hình ảnh (<p:pic>) và khung văn bản (<p:sp>) theo đúng thứ tự xuất hiện trong XML (Z-order)
  const tokenRegex = /<(p:sp|p:pic)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRegex.exec(xmlText)) !== null) {
    const tag = tokenMatch[1].toLowerCase();
    const content = tokenMatch[2];

    // Trích xuất tọa độ <a:xfrm><a:off x="..." y="..."/><a:ext cx="..." cy="..."/></a:xfrm>
    let xEmu: number | undefined;
    let yEmu: number | undefined;
    let wEmu: number | undefined;
    let hEmu: number | undefined;

    const xfrmMatch = content.match(/<a:xfrm\b[\s\S]*?<\/a:xfrm>/i);
    if (xfrmMatch) {
      const offMatch = xfrmMatch[0].match(/<a:off\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/i);
      const extMatch = xfrmMatch[0].match(/<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/i);
      if (offMatch) {
        xEmu = parseInt(offMatch[1], 10);
        yEmu = parseInt(offMatch[2], 10);
      }
      if (extMatch) {
        wEmu = parseInt(extMatch[1], 10);
        hEmu = parseInt(extMatch[2], 10);
      }
    }

    if (tag === 'p:pic') {
      const blipMatch = content.match(/<a:blip\b[^>]*r:embed="([^"]+)"/i);
      if (blipMatch && relsXml) {
        const target = getRelTargetById(relsXml, blipMatch[1]);
        if (target) {
          const dataUrl = await loadZipMediaDataUrl(zip, target, mediaCache);
          if (dataUrl) {
            imageUrls.push(dataUrl);
            shapes.push({
              type: 'image',
              xEmu,
              yEmu,
              wEmu,
              hEmu,
              imageUrl: dataUrl,
            });
          }
        }
      }
    } else if (tag === 'p:sp') {
      const isTitlePlaceholder = /<p:ph\b[^>]*type="(title|ctrTitle)"/i.test(content);

      // Màu nền của riêng shape (<p:spPr> ... <a:solidFill>)
      let fillColorHex: string | undefined;
      const spPrMatch = content.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/i);
      if (spPrMatch && !/<a:noFill\b/i.test(spPrMatch[0])) {
        fillColorHex = extractColorFromXmlBlock(spPrMatch[0], themeColors);
      }

      const txBodyMatch = content.match(/<p:txBody\b[\s\S]*?<\/p:txBody>/i);
      if (!txBodyMatch) continue;

      const shapeParagraphs: PptxParagraph[] = [];
      const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi;
      let pMatch: RegExpExecArray | null;

      while ((pMatch = pRegex.exec(txBodyMatch[0])) !== null) {
        const pContent = pMatch[1];
        const pPrMatch = pContent.match(/<a:pPr\b([^>]*)(?:>([\s\S]*?)<\/a:pPr>|\/>)/i);
        let align: 'left' | 'center' | 'right' | 'justify' = isTitlePlaceholder ? 'left' : 'left';
        let level = 0;
        let isBullet = false;

        if (pPrMatch) {
          const attrs = pPrMatch[1] || '';
          const innerPPr = pPrMatch[2] || '';
          const algnMatch = attrs.match(/\balgn="([^"]+)"/i);
          if (algnMatch) {
            const a = algnMatch[1].toLowerCase();
            if (a === 'ctr') align = 'center';
            else if (a === 'r') align = 'right';
            else if (a === 'just') align = 'justify';
          }
          const lvlMatch = attrs.match(/\blvl="(\d+)"/i);
          if (lvlMatch) level = parseInt(lvlMatch[1], 10);
          if (/<a:buChar\b|<a:buAutoNum\b/i.test(innerPPr) && !/<a:buNone\b/i.test(innerPPr)) {
            isBullet = true;
          }
        }

        const runs: PptxTextRun[] = [];
        const rRegex = /<a:r\b[^>]*>([\s\S]*?)<\/a:r>/gi;
        let rMatch: RegExpExecArray | null;

        while ((rMatch = rRegex.exec(pContent)) !== null) {
          const rContent = rMatch[1];
          const tMatch = rContent.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/i);
          if (!tMatch) continue;
          const textVal = unescapeXml(tMatch[1]);
          if (!textVal) continue;

          let fontSizePt: number | undefined;
          let bold = false;
          let italic = false;
          let colorHex: string | undefined;

          const rPrMatch = rContent.match(/<a:rPr\b([^>]*)(?:>([\s\S]*?)<\/a:rPr>|\/>)/i);
          if (rPrMatch) {
            const rAttrs = rPrMatch[1] || '';
            const rInner = rPrMatch[2] || '';
            const szMatch = rAttrs.match(/\bsz="(\d+)"/i);
            if (szMatch) {
              fontSizePt = Math.round(parseInt(szMatch[1], 10) / 100);
            }
            if (/\bb="1"|\bb="true"/i.test(rAttrs)) bold = true;
            if (/\bi="1"|\bi="true"/i.test(rAttrs)) italic = true;
            colorHex = extractColorFromXmlBlock(rInner, themeColors);
          }

          runs.push({
            text: textVal,
            fontSizePt,
            bold,
            italic,
            colorHex,
          });
        }

        // Trường hợp có thẻ <a:fld> hoặc <a:t> trực tiếp không nằm trong <a:r>
        if (runs.length === 0) {
          const fallbackTRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi;
          let ftMatch: RegExpExecArray | null;
          let joined = '';
          while ((ftMatch = fallbackTRegex.exec(pContent)) !== null) {
            joined += unescapeXml(ftMatch[1]);
          }
          if (joined.trim()) {
            runs.push({ text: joined });
          }
        }

        const fullLineText = runs.map((r) => r.text).join('').trim();
        if (fullLineText) {
          if (!title) {
            title = fullLineText;
          } else {
            paragraphsFlat.push(fullLineText);
          }
          shapeParagraphs.push({
            runs,
            align,
            level,
            isBullet,
          });
        }
      }

      if (shapeParagraphs.length > 0) {
        shapes.push({
          type: 'text',
          xEmu,
          yEmu,
          wEmu,
          hEmu,
          isTitlePlaceholder,
          fillColorHex,
          paragraphs: shapeParagraphs,
        });
      }
    }
  }

  // Nếu rels có chứa thêm ảnh mà chưa được tham chiếu qua <p:pic> (ví dụ nằm trong <p:grpSp> phức tạp), bổ sung vào
  if (relsXml && imageUrls.length === 0) {
    const relImages = parseSlideRelsImages(relsXml);
    for (const mediaPath of relImages) {
      const dataUrl = await loadZipMediaDataUrl(zip, mediaPath, mediaCache);
      if (dataUrl && dataUrl !== bgImageUrl) {
        imageUrls.push(dataUrl);
      }
    }
  }

  const hasExactLayout = shapes.some((s) => s.xEmu !== undefined || s.type === 'image');

  return {
    title,
    paragraphs: paragraphsFlat,
    imageUrls,
    bgImageUrl,
    bgColorHex,
    shapes,
    hasExactLayout,
  };
}

/**
 * Trích xuất đường dẫn file ảnh từ quan hệ _rels của slide
 */
function parseSlideRelsImages(relsXml: string): string[] {
  const images: string[] = [];
  const relRegex = /<Relationship\b[^>]*Type="[^"]*image"[^>]*Target="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = relRegex.exec(relsXml)) !== null) {
    images.push(match[1]);
  }
  return images;
}

function getRelTargetById(relsXml: string, rId: string): string | null {
  const regex = new RegExp(`<Relationship\\b[^>]*Id="${rId}"[^>]*Target="([^"]+)"`, 'i');
  const match = regex.exec(relsXml);
  return match ? match[1] : null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function convertExcelToPdfBuffer(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(5);
  const arrayBuffer =
    fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  onProgress?.(15);

  const backendPdf = await tryConvertViaBackend(arrayBuffer, fileName, onProgress);
  if (backendPdf) {
    return backendPdf;
  }

  const fallbackPages = [
    [
      `Bảng tính Excel: ${fileName}`,
      '(Vui lòng kết nối máy chủ Gotenberg VPS để hiển thị đầy đủ bảng tính, công thức và biểu đồ dưới dạng PDF vector.)',
    ],
  ];
  return createFallbackPdf(fallbackPages);
}

export async function convertOfficeDocumentToPdfBuffer(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  if (isPowerPointFile(fileName)) {
    return convertPowerPointToPdfBuffer(fileOrBuffer, fileName, onProgress);
  }
  if (isExcelFile(fileName)) {
    return convertExcelToPdfBuffer(fileOrBuffer, fileName, onProgress);
  }
  return convertWordToPdfBuffer(fileOrBuffer, fileName, onProgress);
}


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

export function isOfficeFile(fileName: string, mimeType?: string): boolean {
  return isWordFile(fileName, mimeType) || isPowerPointFile(fileName, mimeType);
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

export async function convertWordToPdfBuffer(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string
): Promise<ArrayBuffer> {
  const arrayBuffer =
    fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;

  const isDocx = fileName.toLowerCase().endsWith('.docx');

  let htmlContent = '';
  let rawTextFallback: string[] = [];

  if (isDocx) {
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      htmlContent = result.value;
      if (result.messages && result.messages.length > 0) {
        console.warn('Mammoth warnings for', fileName, result.messages);
      }
    } catch (err) {
      console.warn('Mammoth convert failed, falling back to raw extraction:', err);
      rawTextFallback = extractRawStringsFromBinary(arrayBuffer);
    }
  } else {
    // File .doc cũ
    rawTextFallback = extractRawStringsFromBinary(arrayBuffer);
  }

  // Trường hợp môi trường không có DOM (như Unit test Node.js)
  if (typeof document === 'undefined') {
    const textLines = htmlContent
      ? htmlContent.replace(/<[^>]+>/g, '\n').split('\n').filter((l) => l.trim().length > 0)
      : rawTextFallback;

    // Phân trang 35 dòng mỗi trang A4
    const pages: string[][] = [];
    const linesPerPage = 35;
    for (let i = 0; i < textLines.length; i += linesPerPage) {
      pages.push(textLines.slice(i, i + linesPerPage));
    }
    if (pages.length === 0) pages.push(['(Tài liệu trống)']);
    return createFallbackPdf(pages, [PageSizes.A4[0], PageSizes.A4[1]], false);
  }

  // Môi trường Browser: Render DOM + html2canvas-pro + pdf-lib
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.zIndex = '-1000';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  try {
    const pageWrapper = document.createElement('div');
    pageWrapper.style.width = '794px'; // ~ chuẩn 96 DPI của A4 (210mm)
    pageWrapper.style.minHeight = '1123px'; // ~ chuẩn A4 (297mm)
    pageWrapper.style.padding = '56px 64px';
    pageWrapper.style.boxSizing = 'border-box';
    pageWrapper.style.backgroundColor = '#ffffff';
    pageWrapper.style.color = '#1e293b';
    pageWrapper.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    pageWrapper.style.fontSize = '14px';
    pageWrapper.style.lineHeight = '1.7';
    pageWrapper.className = 'w2l-office-word-page';

    // Thêm CSS reset tối thiểu cho thẻ sinh từ Mammoth
    pageWrapper.innerHTML = `
      <style>
        .w2l-office-word-page h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 12px; margin-top: 16px; }
        .w2l-office-word-page h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 10px; margin-top: 14px; }
        .w2l-office-word-page h3 { font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 8px; margin-top: 12px; }
        .w2l-office-word-page p { margin-bottom: 10px; text-align: justify; }
        .w2l-office-word-page table { width: 100%; border-collapse: collapse; margin: 14px 0; }
        .w2l-office-word-page th, .w2l-office-word-page td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 13px; }
        .w2l-office-word-page th { background-color: #f1f5f9; font-weight: 600; }
        .w2l-office-word-page ul, .w2l-office-word-page ol { padding-left: 24px; margin-bottom: 10px; }
        .w2l-office-word-page img { max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px; }
      </style>
    `;

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

    // Phân trang tự động theo chiều cao (A4 content max ~ 980px)
    const childNodes = Array.from(contentDiv.children) as HTMLElement[];
    const pagesElements: HTMLElement[] = [];
    let currentPageDiv = createWordPageContainer();
    let currentHeight = 0;
    const maxPageContentHeight = 980; // Trừ padding 56px trên và dưới

    if (childNodes.length === 0) {
      currentPageDiv.innerHTML = `<p style="color: #64748b; font-style: italic;">(Tài liệu "${escapeHtml(fileName)}" không có nội dung văn bản hiển thị)</p>`;
      pagesElements.push(currentPageDiv);
    } else {
      for (const node of childNodes) {
        const nodeHeight = node.offsetHeight || 30;
        if (currentHeight + nodeHeight > maxPageContentHeight && currentHeight > 0) {
          pagesElements.push(currentPageDiv);
          currentPageDiv = createWordPageContainer();
          currentHeight = 0;
        }
        currentPageDiv.appendChild(node.cloneNode(true));
        currentHeight += nodeHeight;
      }
      if (currentPageDiv.children.length > 0) {
        pagesElements.push(currentPageDiv);
      }
    }

    container.innerHTML = '';
    const pdfDoc = await PDFDocument.create();

    for (const pageEl of pagesElements) {
      container.appendChild(pageEl);
      const canvas = await html2canvas(pageEl, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      container.removeChild(pageEl);

      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const imgBytes = await fetch(imgDataUrl).then((r) => r.arrayBuffer());
      const embeddedImg = await pdfDoc.embedJpg(imgBytes);

      const pdfPage = pdfDoc.addPage([PageSizes.A4[0], PageSizes.A4[1]]);
      pdfPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: PageSizes.A4[0],
        height: PageSizes.A4[1],
      });
    }

    const saved = await pdfDoc.save();
    return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

function createWordPageContainer(): HTMLElement {
  const page = document.createElement('div');
  page.style.width = '794px';
  page.style.height = '1123px';
  page.style.padding = '56px 64px';
  page.style.boxSizing = 'border-box';
  page.style.backgroundColor = '#ffffff';
  page.style.color = '#1e293b';
  page.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  page.style.fontSize = '14px';
  page.style.lineHeight = '1.7';
  page.style.overflow = 'hidden';
  return page;
}

// ============================================================================
// CHUYỂN ĐỔI POWERPOINT (.PPTX, .PPT) SANG PDF
// ============================================================================

interface SlideParsedData {
  title: string;
  paragraphs: string[];
  imageUrls: string[];
}

export async function convertPowerPointToPdfBuffer(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string
): Promise<ArrayBuffer> {
  const arrayBuffer =
    fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;

  const isPptx = fileName.toLowerCase().endsWith('.pptx');
  const slides: SlideParsedData[] = [];

  if (isPptx) {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Tìm tất cả các slide trong ppt/slides/slide{n}.xml
      const slideFileNames = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10);
          const numB = parseInt(b.replace(/\D/g, ''), 10);
          return numA - numB;
        });

      for (let i = 0; i < slideFileNames.length; i++) {
        const slideName = slideFileNames[i];
        const xmlText = await zip.files[slideName].async('text');

        // Phân tích text từ thẻ <a:t>
        const parsedSlide = parseSlideXml(xmlText);

        // Trích xuất ảnh nhúng của slide nếu có
        const relsFileName = slideName.replace(
          /ppt\/slides\/slide(\d+)\.xml$/i,
          'ppt/slides/_rels/slide$1.xml.rels'
        );
        if (zip.files[relsFileName]) {
          try {
            const relsXml = await zip.files[relsFileName].async('text');
            const mediaPaths = parseSlideRelsImages(relsXml);
            for (const mediaPath of mediaPaths) {
              const fullPath = `ppt/${mediaPath.replace(/^\.\.\//, '')}`;
              if (zip.files[fullPath]) {
                const imgData = await zip.files[fullPath].async('base64');
                const ext = fullPath.split('.').pop()?.toLowerCase() || 'png';
                const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
                parsedSlide.imageUrls.push(`data:${mime};base64,${imgData}`);
              }
            }
          } catch (relsErr) {
            console.warn('Error reading slide rels:', relsErr);
          }
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
        title: chunk[0] || `Slide ${(i / chunkSize) + 1}`,
        paragraphs: chunk.slice(1),
        imageUrls: [],
      });
    }
    if (slides.length === 0) {
      slides.push({
        title: fileName,
        paragraphs: ['(Tập tin trình chiếu không có nội dung văn bản)'],
        imageUrls: [],
      });
    }
  }

  // Kích thước chuẩn slide 16:9: 960 x 540 điểm ảnh
  const slideWidth = 960;
  const slideHeight = 540;

  // Trường hợp không có DOM (Node test)
  if (typeof document === 'undefined') {
    const pages = slides.map((s) => [s.title, ...s.paragraphs]);
    return createFallbackPdf(pages, [slideWidth, slideHeight], true);
  }

  // Môi trường Browser
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.zIndex = '-1000';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  try {
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideEl = document.createElement('div');
      slideEl.style.width = `${slideWidth}px`;
      slideEl.style.height = `${slideHeight}px`;
      slideEl.style.boxSizing = 'border-box';
      slideEl.style.padding = '44px 56px';
      slideEl.style.backgroundColor = '#ffffff';
      slideEl.style.background = 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)';
      slideEl.style.color = '#0f172a';
      slideEl.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      slideEl.style.display = 'flex';
      slideEl.style.flexDirection = 'column';
      slideEl.style.justifyContent = 'flex-start';
      slideEl.style.overflow = 'hidden';
      slideEl.style.position = 'relative';

      // Header slide
      const headerDiv = document.createElement('div');
      headerDiv.style.borderBottom = '2px solid #3b82f6';
      headerDiv.style.paddingBottom = '12px';
      headerDiv.style.marginBottom = '24px';
      headerDiv.style.display = 'flex';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.alignItems = 'baseline';

      const titleEl = document.createElement('h2');
      titleEl.style.fontSize = '26px';
      titleEl.style.fontWeight = '700';
      titleEl.style.color = '#1e3a8a';
      titleEl.style.margin = '0';
      titleEl.textContent = slide.title || `Slide ${i + 1}`;
      headerDiv.appendChild(titleEl);

      const numEl = document.createElement('span');
      numEl.style.fontSize = '12px';
      numEl.style.fontWeight = '600';
      numEl.style.color = '#64748b';
      numEl.textContent = `${i + 1} / ${slides.length}`;
      headerDiv.appendChild(numEl);

      slideEl.appendChild(headerDiv);

      // Body slide: Cột chữ và cột ảnh (nếu có)
      const bodyDiv = document.createElement('div');
      bodyDiv.style.display = 'flex';
      bodyDiv.style.gap = '24px';
      bodyDiv.style.flex = '1';
      bodyDiv.style.minHeight = '0';

      const textCol = document.createElement('div');
      textCol.style.flex = slide.imageUrls.length > 0 ? '1.4' : '1';
      textCol.style.display = 'flex';
      textCol.style.flexDirection = 'column';
      textCol.style.gap = '10px';

      for (const p of slide.paragraphs) {
        if (!p.trim()) continue;
        const pEl = document.createElement('div');
        pEl.style.fontSize = '16px';
        pEl.style.lineHeight = '1.6';
        pEl.style.color = '#334155';
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
        imgCol.style.flexDirection = 'column';
        imgCol.style.justifyContent = 'center';
        imgCol.style.alignItems = 'center';

        const img = document.createElement('img');
        img.src = slide.imageUrls[0];
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        imgCol.appendChild(img);
        bodyDiv.appendChild(imgCol);
      }

      slideEl.appendChild(bodyDiv);

      container.appendChild(slideEl);
      const canvas = await html2canvas(slideEl, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
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
    }

    const saved = await pdfDoc.save();
    return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Trích xuất text từ slide XML OOXML
 */
function parseSlideXml(xmlText: string): SlideParsedData {
  const paragraphs: string[] = [];
  let title = '';

  // Tìm tất cả các thẻ đoạn văn <a:p>
  const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(xmlText)) !== null) {
    const pContent = pMatch[1];
    // Tìm tất cả các đoạn text <a:t> trong đoạn văn
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi;
    let tMatch: RegExpExecArray | null;
    let fullPText = '';

    while ((tMatch = tRegex.exec(pContent)) !== null) {
      fullPText += unescapeXml(tMatch[1]);
    }

    const trimmed = fullPText.trim();
    if (trimmed) {
      if (!title) {
        title = trimmed;
      } else {
        paragraphs.push(trimmed);
      }
    }
  }

  return {
    title,
    paragraphs,
    imageUrls: [],
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

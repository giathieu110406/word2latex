import { PDFDocument, PageSizes, degrees, rgb, StandardFonts, PDFName } from 'pdf-lib';
import type { PdfSourceFile, VirtualPage, WatermarkConfig } from '../store/usePdfEditorStore';

export async function parsePdfBufferMetadata(buffer: ArrayBuffer): Promise<{ totalPages: number }> {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return {
    totalPages: pdfDoc.getPageCount(),
  };
}

export async function convertImageFileToPdfBuffer(file: File): Promise<ArrayBuffer> {
  const imgBytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.create();
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  const embeddedImg = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

  // Giữ nguyên đúng 100% tỷ lệ và khung hình (aspect ratio) gốc của ảnh tải lên
  // Chuẩn hóa kích thước trang về dải PDF tiêu chuẩn (cạnh lớn nhất ~ 842pt nếu ảnh quá nhỏ/quá lớn) nhưng giữ đúng tỷ lệ 1:1 với ảnh, không viền trắng A4
  let pageWidth = embeddedImg.width;
  let pageHeight = embeddedImg.height;
  const maxDim = Math.max(pageWidth, pageHeight);
  if (maxDim > 1440) {
    const downScale = 1440 / maxDim;
    pageWidth = Math.round(pageWidth * downScale * 100) / 100;
    pageHeight = Math.round(pageHeight * downScale * 100) / 100;
  } else if (maxDim < 200 && maxDim > 0) {
    const upScale = 600 / maxDim;
    pageWidth = Math.round(pageWidth * upScale * 100) / 100;
    pageHeight = Math.round(pageHeight * upScale * 100) / 100;
  }

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  page.drawImage(embeddedImg, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  const saved = await pdfDoc.save();
  return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength);
}

function hexToRgbColor(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2) || 'ef', 16) / 255;
  const g = parseInt(clean.substring(2, 4) || '44', 16) / 255;
  const b = parseInt(clean.substring(4, 6) || '44', 16) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0.9,
    Number.isFinite(g) ? g : 0.2,
    Number.isFinite(b) ? b : 0.2
  );
}

function removeVietnameseDiacriticsForStandardFont(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Vẽ watermark chữ (tiếng Việt có dấu UTF-8) hoặc ảnh logo bằng HTML5 Canvas và xuất thành PNG buffer nhúng vào PDF
 */
async function renderWatermarkToPngBytes(
  watermark: WatermarkConfig,
  pageWidth: number,
  pageHeight: number
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  try {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pageWidth * scale);
    canvas.height = Math.round(pageHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, pageWidth, pageHeight);

    ctx.save();
    ctx.translate(pageWidth / 2, pageHeight / 2);
    if (watermark.diagonal) {
      // Góc xoay chéo 35 độ
      ctx.rotate((-35 * Math.PI) / 180);
    }
    ctx.globalAlpha = watermark.opacity ?? 0.25;

    if (watermark.type === 'image' && watermark.imageDataUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Cannot load watermark image'));
        img.src = watermark.imageDataUrl!;
      });

      const maxDim = Math.min(pageWidth, pageHeight) * ((watermark.imageScale || 40) / 100);
      const ratio = img.width / (img.height || 1);
      let drawW = maxDim;
      let drawH = maxDim / ratio;
      if (drawH > maxDim) {
        drawH = maxDim;
        drawW = maxDim * ratio;
      }
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    } else if (watermark.text && watermark.text.trim()) {
      const fontSize = watermark.fontSize || 42;
      ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = watermark.color || '#EF4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(watermark.text.trim(), 0, 0);
    }

    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    const res = await fetch(dataUrl);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err) {
    console.warn('Canvas watermark rendering fallback:', err);
    return null;
  }
}

export interface ExportPdfOptions {
  files: PdfSourceFile[];
  pages: VirtualPage[];
  watermark?: WatermarkConfig;
  flatten?: boolean;
  onProgress?: (percent: number) => void;
}

export async function exportEditedPdf({
  files,
  pages,
  watermark,
  flatten = false,
  onProgress,
}: ExportPdfOptions): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();
  const loadedSourceDocs = new Map<string, PDFDocument>();

  for (const file of files) {
    if (file.rawData && file.rawData.byteLength > 0) {
      const doc = await PDFDocument.load(file.rawData, { ignoreEncryption: true });
      loadedSourceDocs.set(file.id, doc);
    }
  }

  let watermarkFont = null;
  if (watermark?.enabled && watermark.type !== 'image' && watermark.text?.trim()) {
    watermarkFont = await outDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const hasWatermark =
    !!watermark?.enabled &&
    ((watermark.type === 'image' && !!watermark.imageDataUrl) ||
      (watermark.type !== 'image' && !!watermark.text?.trim()));

  const total = pages.length || 1;
  for (let i = 0; i < pages.length; i++) {
    const vp = pages[i];
    let targetPage;

    if (vp.isBlank || vp.originalPageIndex < 0) {
      targetPage = outDoc.addPage(PageSizes.A4);
      if (vp.rotation) {
        targetPage.setRotation(degrees(vp.rotation));
      }
    } else {
      const srcDoc = loadedSourceDocs.get(vp.sourceFileId);
      if (srcDoc && vp.originalPageIndex < srcDoc.getPageCount()) {
        const [copiedPage] = await outDoc.copyPages(srcDoc, [vp.originalPageIndex]);
        const existingRotation = copiedPage.getRotation().angle || 0;
        const combinedRotation = ((existingRotation + vp.rotation) % 360 + 360) % 360;
        copiedPage.setRotation(degrees(combinedRotation));
        targetPage = outDoc.addPage(copiedPage);
      } else {
        targetPage = outDoc.addPage(PageSizes.A4);
      }
    }

    if (hasWatermark && targetPage) {
      const { width, height } = targetPage.getSize();
      const pngBytes = await renderWatermarkToPngBytes(watermark!, width, height);

      if (pngBytes) {
        const embeddedImg = await outDoc.embedPng(pngBytes);
        targetPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width,
          height,
        });
      } else if (watermarkFont && watermark?.text?.trim()) {
        // Fallback cho môi trường Node test
        const safeText = removeVietnameseDiacriticsForStandardFont(watermark.text.trim());
        const fontSize = watermark.fontSize || 40;
        const textWidth = watermarkFont.widthOfTextAtSize(safeText, fontSize);
        const color = hexToRgbColor(watermark.color || '#EF4444');

        targetPage.drawText(safeText, {
          x: Math.max(24, (width - textWidth) / 2),
          y: height / 2,
          size: fontSize,
          font: watermarkFont,
          color,
          opacity: watermark.opacity ?? 0.25,
          rotate: watermark.diagonal ? degrees(35) : degrees(0),
        });
      }
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 90));
    }
  }

  if (flatten) {
    try {
      const form = outDoc.getForm();
      form.flatten();
    } catch {
      // Ignore if document has no interactive form fields
    }

    // Khóa cứng (Lock & Flatten) toàn bộ lớp chú thích (annotations/widgets) trên tất cả các trang
    for (const page of outDoc.getPages()) {
      try {
        page.node.delete(PDFName.of('Annots'));
      } catch {}
    }
  }

  const savedBytes = await outDoc.save();
  if (onProgress) onProgress(100);
  return savedBytes;
}

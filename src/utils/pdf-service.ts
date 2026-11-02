import { PDFDocument, PageSizes, degrees, rgb, StandardFonts } from 'pdf-lib';
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

  const pageWidth = PageSizes.A4[0];
  const pageHeight = PageSizes.A4[1];
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const margin = 24;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const scale = Math.min(maxW / embeddedImg.width, maxH / embeddedImg.height, 1);
  const drawW = embeddedImg.width * scale;
  const drawH = embeddedImg.height * scale;

  page.drawImage(embeddedImg, {
    x: (pageWidth - drawW) / 2,
    y: (pageHeight - drawH) / 2,
    width: drawW,
    height: drawH,
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
  if (watermark?.enabled && watermark.text.trim()) {
    watermarkFont = await outDoc.embedFont(StandardFonts.HelveticaBold);
  }

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

    if (watermark?.enabled && watermark.text.trim() && watermarkFont && targetPage) {
      const { width, height } = targetPage.getSize();
      const safeText = removeVietnameseDiacriticsForStandardFont(watermark.text.trim());
      const fontSize = watermark.fontSize || 40;
      const textWidth = watermarkFont.widthOfTextAtSize(safeText, fontSize);
      const color = hexToRgbColor(watermark.color || '#EF4444');

      targetPage.drawText(safeText, {
        x: Math.max(24, (width - textWidth * 0.75) / 2),
        y: height / 2,
        size: fontSize,
        font: watermarkFont,
        color,
        opacity: watermark.opacity ?? 0.25,
        rotate: watermark.diagonal ? degrees(35) : degrees(0),
      });
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
  }

  const savedBytes = await outDoc.save();
  if (onProgress) onProgress(100);
  return savedBytes;
}

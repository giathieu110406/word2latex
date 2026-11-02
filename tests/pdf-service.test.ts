import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { exportEditedPdf, parsePdfBufferMetadata } from '../src/utils/pdf-service';
import type { PdfSourceFile, VirtualPage, WatermarkConfig } from '../src/store/usePdfEditorStore';

async function createSamplePdfBuffer(numPages: number, label: string): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < numPages; i++) {
    const page = doc.addPage([600, 800]);
    page.drawText(`${label} - Page ${i + 1}`, { x: 50, y: 700, size: 20 });
  }
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

test('parsePdfBufferMetadata returns exact totalPages', async () => {
  const buf = await createSamplePdfBuffer(3, 'DocA');
  const meta = await parsePdfBufferMetadata(buf);
  assert.equal(meta.totalPages, 3);
});

test('exportEditedPdf merges multiple files, applies rotation, inserts blank page, watermark and flatten', async () => {
  const buf1 = await createSamplePdfBuffer(2, 'Doc1');
  const buf2 = await createSamplePdfBuffer(1, 'Doc2');

  const files: PdfSourceFile[] = [
    { id: 'f1', name: 'Doc1.pdf', size: buf1.byteLength, rawData: buf1, totalPages: 2, colorBadge: '#FEE2E2' },
    { id: 'f2', name: 'Doc2.pdf', size: buf2.byteLength, rawData: buf2, totalPages: 1, colorBadge: '#DBEAFE' },
  ];

  const pages: VirtualPage[] = [
    { id: 'p1', sourceFileId: 'f1', originalPageIndex: 0, rotation: 90, isBlank: false },
    { id: 'p_blank', sourceFileId: 'blank', originalPageIndex: -1, rotation: 0, isBlank: true },
    { id: 'p2', sourceFileId: 'f2', originalPageIndex: 0, rotation: 180, isBlank: false },
    // Duplicate of Doc1 page 2
    { id: 'p3', sourceFileId: 'f1', originalPageIndex: 1, rotation: 0, isBlank: false },
    { id: 'p4', sourceFileId: 'f1', originalPageIndex: 1, rotation: 270, isBlank: false },
  ];

  const watermark: WatermarkConfig = {
    enabled: true,
    text: 'CONFIDENTIAL TEST',
    opacity: 0.3,
    fontSize: 36,
    color: '#EF4444',
    diagonal: true,
  };

  const exportedBytes = await exportEditedPdf({
    files,
    pages,
    watermark,
    flatten: true,
  });

  const resultDoc = await PDFDocument.load(exportedBytes);
  assert.equal(resultDoc.getPageCount(), 5);
  assert.equal(resultDoc.getPage(0).getRotation().angle, 90);
  assert.equal(resultDoc.getPage(1).getRotation().angle, 0);
  assert.equal(resultDoc.getPage(2).getRotation().angle, 180);
  assert.equal(resultDoc.getPage(3).getRotation().angle, 0);
  assert.equal(resultDoc.getPage(4).getRotation().angle, 270);
});

test('exportEditedPdf handles Vietnamese text watermark and flatten flag successfully', async () => {
  const buf = await createSamplePdfBuffer(2, 'DocVN');
  const files: PdfSourceFile[] = [
    { id: 'f_vn', name: 'DocVN.pdf', size: buf.byteLength, rawData: buf, totalPages: 2, colorBadge: '#CCFBF1' },
  ];
  const pages: VirtualPage[] = [
    { id: 'p_vn_1', sourceFileId: 'f_vn', originalPageIndex: 0, rotation: 0, isBlank: false },
    { id: 'p_vn_2', sourceFileId: 'f_vn', originalPageIndex: 1, rotation: 0, isBlank: false },
  ];

  const watermark: WatermarkConfig = {
    enabled: true,
    type: 'text',
    text: 'BẢN SAO CHÍNH THỨC - ĐÃ PHÊ DUYỆT',
    opacity: 0.4,
    fontSize: 40,
    color: '#059669',
    diagonal: true,
  };

  const exported = await exportEditedPdf({
    files,
    pages,
    watermark,
    flatten: true,
  });

  const doc = await PDFDocument.load(exported);
  assert.equal(doc.getPageCount(), 2);
});

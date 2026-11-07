import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { inspectDocumentMedia } from '../server/document-inspector.js';

test('inspectDocumentMedia identifies image files as requiring vision processing', async () => {
  const dummyBuffer = Buffer.from('fake image content');
  
  const pngResult = await inspectDocumentMedia(dummyBuffer, 'image/png', 'diagram.png');
  assert.equal(pngResult.hasImagesOrScan, true);
  assert.equal(pngResult.reason, 'image_file');

  const jpgResult = await inspectDocumentMedia(dummyBuffer, 'image/jpeg', 'exam_scan.jpg');
  assert.equal(jpgResult.hasImagesOrScan, true);
  assert.equal(jpgResult.reason, 'image_file');
});

test('inspectDocumentMedia identifies spreadsheets and plain text as pure text', async () => {
  const dummyBuffer = Buffer.from('column1,column2\nval1,val2');

  const csvResult = await inspectDocumentMedia(dummyBuffer, 'text/csv', 'data.csv');
  assert.equal(csvResult.hasImagesOrScan, false);
  assert.equal(csvResult.reason, 'pure_tabular_text');

  const txtResult = await inspectDocumentMedia(dummyBuffer, 'text/plain', 'notes.txt');
  assert.equal(txtResult.hasImagesOrScan, false);
  assert.equal(txtResult.reason, 'pure_tabular_text');

  const xlsxResult = await inspectDocumentMedia(dummyBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'scores.xlsx');
  assert.equal(xlsxResult.hasImagesOrScan, false);
  assert.equal(xlsxResult.reason, 'pure_tabular_text');
});

test('inspectDocumentMedia detects whether DOCX contains embedded images or is pure text', async () => {
  // 1. DOCX không có ảnh
  const pureZip = new JSZip();
  pureZip.file('word/document.xml', '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Đề thi Toán học</w:t></w:r></w:p></w:body></w:document>');
  const pureDocxBuffer = await pureZip.generateAsync({ type: 'nodebuffer' });

  const pureResult = await inspectDocumentMedia(
    pureDocxBuffer, 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'dethi_thuanchu.docx'
  );
  assert.equal(pureResult.hasImagesOrScan, false);
  assert.equal(pureResult.reason, 'docx_pure_text');

  // 2. DOCX có ảnh trong word/media/
  const mediaZip = new JSZip();
  mediaZip.file('word/document.xml', '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Hình minh họa bên dưới</w:t></w:r></w:p></w:body></w:document>');
  mediaZip.file('word/media/image1.png', 'binary image bytes');
  const mediaDocxBuffer = await mediaZip.generateAsync({ type: 'nodebuffer' });

  const mediaResult = await inspectDocumentMedia(
    mediaDocxBuffer, 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'dethi_co_hinhve.docx'
  );
  assert.equal(mediaResult.hasImagesOrScan, true);
  assert.equal(mediaResult.reason, 'docx_embedded_media');
});

test('inspectDocumentMedia identifies PDF with images as requiring vision processing', async () => {
  const pdfWithImage = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /XObject /Subtype /Image /Width 100 /Height 100 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
  );

  const resultWithImage = await inspectDocumentMedia(pdfWithImage, 'application/pdf', 'sample_diagram.pdf');
  assert.equal(resultWithImage.hasImagesOrScan, true);
  assert.equal(resultWithImage.reason, 'pdf_contains_images');

  const pdfPureText = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Pages /Kids [2 0 R] /Count 1 >>\nendobj\n2 0 obj\n<< /Type /Page /Contents 3 0 R >>\nendobj\n3 0 obj\n<< /Length 40 >>\nstream\nBT /F1 12 Tf 72 712 Td (Pure text document) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
  );

  const resultPureText = await inspectDocumentMedia(pdfPureText, 'application/pdf', 'plain_text.pdf');
  assert.equal(resultPureText.hasImagesOrScan, false);
  assert.equal(resultPureText.reason, 'pdf_pure_text');
});

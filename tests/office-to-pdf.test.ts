import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import {
  isWordFile,
  isPowerPointFile,
  isOfficeFile,
  convertWordToPdfBuffer,
  convertPowerPointToPdfBuffer,
} from '../src/utils/office-to-pdf';

test('isWordFile, isPowerPointFile, isOfficeFile correctly identify file types and mime types', () => {
  assert.equal(isWordFile('document.docx'), true);
  assert.equal(isWordFile('report.doc'), true);
  assert.equal(isWordFile('unknown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), true);
  assert.equal(isWordFile('unknown', 'application/msword'), true);
  assert.equal(isWordFile('presentation.pptx'), false);
  assert.equal(isWordFile('file.pdf'), false);

  assert.equal(isPowerPointFile('slides.pptx'), true);
  assert.equal(isPowerPointFile('deck.ppt'), true);
  assert.equal(isPowerPointFile('unknown', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), true);
  assert.equal(isPowerPointFile('unknown', 'application/vnd.ms-powerpoint'), true);
  assert.equal(isPowerPointFile('document.docx'), false);

  assert.equal(isOfficeFile('slides.pptx'), true);
  assert.equal(isOfficeFile('document.docx'), true);
  assert.equal(isOfficeFile('data.pdf'), false);
  assert.equal(isOfficeFile('image.png'), false);
});

test('convertWordToPdfBuffer converts docx / raw doc text to valid PDF buffer', async () => {
  // Tạo buffer giả lập văn bản Word
  const encoder = new TextEncoder();
  const sampleText = 'Đây là nội dung tài liệu Word kiểm thử.\nĐoạn văn 2: Công thức và dữ liệu biên tập PDF.';
  const fakeDocBuffer = encoder.encode(sampleText).buffer;

  const pdfBuffer = await convertWordToPdfBuffer(fakeDocBuffer, 'TestDoc.doc');
  assert.ok(pdfBuffer instanceof ArrayBuffer);
  assert.ok(pdfBuffer.byteLength > 0);

  const doc = await PDFDocument.load(pdfBuffer);
  assert.ok(doc.getPageCount() >= 1);
  const page0 = doc.getPage(0);
  assert.ok(page0.getWidth() > 0);
  assert.ok(page0.getHeight() > 0);
});

test('convertPowerPointToPdfBuffer parses pptx zip structure and converts slides to valid PDF buffer', async () => {
  // Tạo một gói PPTX tối thiểu bằng JSZip
  const zip = new JSZip();

  const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:t>Slide 1: Giới thiệu hệ thống</a:t></a:p>
          <a:p><a:t>Điểm nổi bật: Chuyển đổi slide sang PDF tức thì</a:t></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slide2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:t>Slide 2: Tính năng chi tiết</a:t></a:p>
          <a:p><a:t>Hỗ trợ kéo thả, xoay và làm phẳng tài liệu</a:t></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  zip.file('ppt/slides/slide1.xml', slide1Xml);
  zip.file('ppt/slides/slide2.xml', slide2Xml);

  const pptxArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });

  const pdfBuffer = await convertPowerPointToPdfBuffer(pptxArrayBuffer, 'Presentation.pptx');
  assert.ok(pdfBuffer instanceof ArrayBuffer);
  assert.ok(pdfBuffer.byteLength > 0);

  const doc = await PDFDocument.load(pdfBuffer);
  assert.equal(doc.getPageCount(), 2);

  const slidePage1 = doc.getPage(0);
  assert.equal(slidePage1.getWidth(), 960);
  assert.equal(slidePage1.getHeight(), 540);

  const slidePage2 = doc.getPage(1);
  assert.equal(slidePage2.getWidth(), 960);
  assert.equal(slidePage2.getHeight(), 540);
});

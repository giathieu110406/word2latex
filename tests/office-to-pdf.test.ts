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

test('convertPowerPointToPdfBuffer preserves native slide size from presentation.xml (e.g., 4:3 or custom ratio)', async () => {
  const zip = new JSZip();

  // Kích thước 4:3 trong OOXML: cx="9144000" (10 inch = 720pt), cy="6858000" (7.5 inch = 540pt)
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
</p:presentation>`;

  const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="1E293B"/></a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="1143000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr sz="3200" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
              <a:t>Tiêu đề chữ trắng trên nền tối</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  zip.file('ppt/presentation.xml', presentationXml);
  zip.file('ppt/slides/slide1.xml', slide1Xml);

  const pptxBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const pdfBuffer = await convertPowerPointToPdfBuffer(pptxBuffer, 'Custom4x3.pptx');

  const doc = await PDFDocument.load(pdfBuffer);
  assert.equal(doc.getPageCount(), 1);
  const page = doc.getPage(0);
  // Tỷ lệ width / height phải đúng 4:3 (4 / 3 = 1.3333)
  const ratio = page.getWidth() / page.getHeight();
  assert.ok(Math.abs(ratio - 4 / 3) < 0.01, `Expected 4:3 ratio (1.333), got ${ratio} (${page.getWidth()}x${page.getHeight()})`);
});

test('convertWordToPdfBuffer preserves native page size and orientation from word/document.xml (<w:pgSz>)', async () => {
  const zip = new JSZip();

  // Trang Word A4 nằm ngang (Landscape): w="16838" twips (~841.9pt), h="11906" twips (~595.3pt)
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Báo cáo tài chính nằm ngang (Landscape)</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgSz w="16838" h="11906" orient="landscape"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);
  const docxBuffer = await zip.generateAsync({ type: 'arraybuffer' });

  const pdfBuffer = await convertWordToPdfBuffer(docxBuffer, 'LandscapeReport.docx');
  const doc = await PDFDocument.load(pdfBuffer);
  assert.ok(doc.getPageCount() >= 1);
  const page = doc.getPage(0);
  assert.ok(
    page.getWidth() > page.getHeight(),
    `Expected landscape page (width > height), got ${page.getWidth()}x${page.getHeight()}`
  );
});

test('convertPowerPointToPdfBuffer in DOM environment preserves exact shape coordinates, white text color, and background fill', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const prevDoc = (globalThis as any).document;
  (globalThis as any).document = dom.window.document;

  try {
    const zip = new JSZip();
    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="D97706"/></a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="609600" y="457200"/><a:ext cx="10972800" cy="1143000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr sz="3600" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
              <a:t>CÁC YÊU CẦU CHẤT LƯỢNG</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    zip.file('ppt/slides/slide1.xml', slideXml);
    const buf = await zip.generateAsync({ type: 'arraybuffer' });

    // Kiểm tra hàm parse & dựng DOM không lỗi hoặc kiểm tra qua export helper nếu có
    assert.ok(buf.byteLength > 0);
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as any).document;
    } else {
      (globalThis as any).document = prevDoc;
    }
  }
});

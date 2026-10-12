import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as xlsx from 'xlsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { JSDOM } from 'jsdom';
import { buildWordDocx } from '../src/utils/word-export.js';
import { parseFile } from '../markitdown.js';

// Thiết lập DOM môi trường cho buildWordDocx
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
});

test('parseFile: Plain text (.txt / text/plain) trả về nội dung văn bản', async () => {
  const content = 'Xin chào, đây là văn bản kiểm thử MarkItDown.';
  const base64 = Buffer.from(content, 'utf-8').toString('base64');
  const result = await parseFile(base64, 'text/plain', 'test.txt');
  assert.equal(result, content);
});

test('parseFile: CSV được AnyDoc chuyển đổi thành bảng GFM Markdown', async () => {
  const csvContent = 'Họ và tên,Điểm toán,Xếp loại\nNguyễn Văn A,10,Giỏi\nTrần Thị B,9,Giỏi';
  const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');
  const result = await parseFile(base64, 'text/csv', 'bang_diem.csv');
  assert.ok(result, 'Result should be defined');
  assert.match(result, /\|\s*Họ và tên\s*\|\s*Điểm toán\s*\|\s*Xếp loại\s*\|/);
  assert.match(result, /\|\s*Nguyễn Văn A\s*\|\s*10\s*\|\s*Giỏi\s*\|/);
});

test('parseFile: Excel (.xlsx) được AnyDoc chuyển đổi thành bảng GFM Markdown', async () => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ['Mã số', 'Tên sản phẩm', 'Giá thành'],
    ['SP01', 'Bút bi Thiên Long', 5000],
    ['SP02', 'Vở học sinh', 12000]
  ]);
  xlsx.utils.book_append_sheet(wb, ws, 'DanhMuc');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const base64 = Buffer.from(buffer).toString('base64');

  const result = await parseFile(base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'sanpham.xlsx');
  assert.ok(result, 'Result should be defined');
  assert.match(result, /\|\s*Mã số\s*\|\s*Tên sản phẩm\s*\|\s*Giá thành\s*\|/);
  assert.match(result, /SP01/);
});

test('parseFile: Word (.docx) được AnyDoc trích xuất cấu trúc Markdown', async () => {
  const root = document.createElement('div');
  root.innerHTML = '<h1>Tiêu Đề Báo Cáo</h1><p>Nội dung đoạn văn phân tích chuyên sâu.</p>';
  const docxBlob = await buildWordDocx(root, 'Times New Roman');
  const docxBuf = Buffer.from(await docxBlob.arrayBuffer());
  const base64 = docxBuf.toString('base64');

  const result = await parseFile(
    base64, 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'baocao.docx'
  );
  assert.ok(result, 'Result should be defined');
  assert.match(result, /Tiêu Đề Báo Cáo/);
  assert.match(result, /Nội dung đoạn văn phân tích chuyên sâu/);
});

test('parseFile: PDF có text layer được AnyDoc trích xuất thành Markdown', async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Chuong 1: Tong quan he thong', { x: 50, y: 450, font, size: 20 });
  const pdfBytes = await pdfDoc.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');

  const result = await parseFile(base64, 'application/pdf', 'tai_lieu.pdf');
  assert.ok(result, 'Result should be defined');
  assert.match(result, /Chuong 1: Tong quan he thong/);
});

test('parseFile: PDF trang trống/ảnh kích hoạt needsOcr và trả về null (nhường cho Gemini)', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([400, 400]); // Trang trống hoàn toàn không có text layer
  const pdfBytes = await pdfDoc.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');

  const result = await parseFile(base64, 'application/pdf', 'scan_blank.pdf');
  assert.equal(result, null, 'Trang scan/không có text layer phải trả về null để Gemini Vision xử lý');
});

test('parseFile: Fallback về mammoth khi file Word gặp ngoại lệ AnyDoc', async () => {
  // Tạo buffer không hợp lệ với AnyDoc nhưng mammoth có thể xử lý, hoặc kiểm tra tính năng an toàn
  const invalidBuffer = Buffer.from('Fake word data');
  const base64 = invalidBuffer.toString('base64');
  const result = await parseFile(base64, 'application/msword', 'corrupted.doc');
  // Không được throw unhandled exception
  assert.ok(result === null || typeof result === 'string');
});

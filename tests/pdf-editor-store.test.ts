import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usePdfEditorStore } from '../src/store/usePdfEditorStore';

test('PdfEditorStore: add files and generate virtual pages', () => {
  const store = usePdfEditorStore.getState();
  store.reset();

  const file1 = {
    id: 'f1',
    name: 'DeThi1.pdf',
    size: 1024,
    rawData: new Uint8Array([1, 2, 3]).buffer,
    totalPages: 2,
    colorBadge: '#F43F5E',
  };
  const file2 = {
    id: 'f2',
    name: 'DeThi2.pdf',
    size: 2048,
    rawData: new Uint8Array([4, 5, 6]).buffer,
    totalPages: 3,
    colorBadge: '#3B82F6',
  };

  store.addFiles([file1, file2]);

  const s1 = usePdfEditorStore.getState();
  assert.equal(s1.files.length, 2);
  assert.equal(s1.pages.length, 5);
});

test('PdfEditorStore: getFileSegments splits document when blank page inserted in the middle', () => {
  const store = usePdfEditorStore.getState();
  store.reset();

  // File A có 6 trang
  store.addFiles([
    { id: 'fA', name: 'DeThiHocKy.pdf', size: 1000, rawData: new ArrayBuffer(4), totalPages: 6, colorBadge: '#F43F5E' },
  ]);

  let segments = store.getFileSegments();
  assert.equal(segments.length, 1);
  assert.equal(segments[0].totalPages, 6);
  assert.equal(segments[0].name, 'DeThiHocKy.pdf');

  // Chèn 1 trang trống vào vị trí index = 3 (sau trang 3)
  store.insertBlankPage(3);

  // Lúc này bên File View phải tự động chia thành 3 thẻ phân đoạn:
  // Segment 1: DeThiHocKy (3 trang)
  // Segment 2: Trang trống (1 trang)
  // Segment 3: DeThiHocKy (3 trang)
  segments = store.getFileSegments();
  assert.equal(segments.length, 3);
  assert.equal(segments[0].name, 'DeThiHocKy.pdf');
  assert.equal(segments[0].totalPages, 3);
  assert.equal(segments[0].isBlank, false);

  assert.equal(segments[1].name, 'Trang trống');
  assert.equal(segments[1].totalPages, 1);
  assert.equal(segments[1].isBlank, true);

  assert.equal(segments[2].name, 'DeThiHocKy.pdf');
  assert.equal(segments[2].totalPages, 3);
  assert.equal(segments[2].isBlank, false);
});

test('PdfEditorStore: reorderFileSegments updates pages array correctly', () => {
  const store = usePdfEditorStore.getState();
  store.reset();

  store.addFiles([
    { id: 'fA', name: 'FileA.pdf', size: 100, rawData: new ArrayBuffer(4), totalPages: 2, colorBadge: '#10B981' },
    { id: 'fB', name: 'FileB.pdf', size: 200, rawData: new ArrayBuffer(4), totalPages: 2, colorBadge: '#6366F1' },
  ]);

  let segments = store.getFileSegments();
  assert.equal(segments.length, 2);
  const segAId = segments[0].id;
  const segBId = segments[1].id;

  // Đổi chỗ Segment B lên trước Segment A
  store.reorderFileSegments(segAId, segBId);

  const updatedPages = usePdfEditorStore.getState().pages;
  assert.equal(updatedPages[0].sourceFileId, 'fB');
  assert.equal(updatedPages[1].sourceFileId, 'fB');
  assert.equal(updatedPages[2].sourceFileId, 'fA');
  assert.equal(updatedPages[3].sourceFileId, 'fA');
});

test('PdfEditorStore: removeFileSegment deletes all pages in that segment', () => {
  const store = usePdfEditorStore.getState();
  store.reset();

  store.addFiles([
    { id: 'fA', name: 'FileA.pdf', size: 100, rawData: new ArrayBuffer(4), totalPages: 4, colorBadge: '#10B981' },
  ]);

  store.insertBlankPage(2);
  let segments = store.getFileSegments();
  assert.equal(segments.length, 3);

  // Xóa segment giữa (trang trống)
  store.removeFileSegment(segments[1].id);
  assert.equal(usePdfEditorStore.getState().pages.length, 4);
  assert.ok(usePdfEditorStore.getState().pages.every(p => !p.isBlank));
});

test('PdfEditorStore: batch conversion gate — pages do NOT expand until ALL converting files finish', () => {
  const store = usePdfEditorStore.getState();
  store.reset();

  // Khởi tạo 2 file đang convert
  store.initConvertingFiles([
    {
      id: 'conv1',
      name: 'Slide1.pptx',
      size: 5000,
      rawData: new ArrayBuffer(0),
      totalPages: 1,
      colorBadge: '#FEE2E2',
      status: 'converting',
      conversionProgress: 10,
    },
    {
      id: 'conv2',
      name: 'Doc2.docx',
      size: 3000,
      rawData: new ArrayBuffer(0),
      totalPages: 1,
      colorBadge: '#DBEAFE',
      status: 'converting',
      conversionProgress: 10,
    },
  ]);

  // Trong khi cả 2 file đang convert, chỉ có 2 placeholder pages (1 cho mỗi file)
  let state = usePdfEditorStore.getState();
  assert.equal(state.activeTab, 'files');
  assert.equal(state.pages.length, 2);

  // Khi file 1 convert xong (có 10 trang), file 2 vẫn đang converting:
  // YÊU CẦU: Chưa được bung 10 trang của file 1 ra state.pages để tránh kích hoạt render tab Trang sớm!
  store.completeFileConversion('conv1', {
    rawData: new Uint8Array([1, 2, 3, 4]).buffer,
    totalPages: 10,
  });

  state = usePdfEditorStore.getState();
  const f1 = state.files.find((f) => f.id === 'conv1')!;
  const f2 = state.files.find((f) => f.id === 'conv2')!;
  assert.equal(f1.status, 'ready');
  assert.equal(f1.totalPages, 10);
  assert.equal(f2.status, 'converting');

  // pages vẫn giữ nguyên 2 placeholder pages khi vẫn còn file đang converting!
  assert.equal(
    state.pages.length,
    2,
    'Pages must remain locked as 1 placeholder per file while any file is still converting'
  );
  // Nhưng ở tab Các file, segment của conv1 vẫn hiển thị đúng totalPages = 10
  const segsWhileConverting = store.getFileSegments();
  assert.equal(segsWhileConverting.length, 2);
  assert.equal(segsWhileConverting[0].totalPages, 10);

  // Khi file 2 cũng hoàn tất convert (có 5 trang) -> Tất cả các file đã xong!
  // Lúc này toàn bộ các trang thật (10 + 5 = 15 trang) mới được bung ra đồng loạt!
  store.completeFileConversion('conv2', {
    rawData: new Uint8Array([5, 6, 7, 8]).buffer,
    totalPages: 5,
  });

  state = usePdfEditorStore.getState();
  assert.equal(
    state.pages.length,
    15,
    'Once all files finish converting, all 15 pages must be expanded'
  );
  assert.equal(state.pages.filter((p) => p.sourceFileId === 'conv1').length, 10);
  assert.equal(state.pages.filter((p) => p.sourceFileId === 'conv2').length, 5);
});

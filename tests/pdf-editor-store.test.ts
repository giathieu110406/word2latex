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

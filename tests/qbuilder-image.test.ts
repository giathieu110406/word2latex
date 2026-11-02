import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  registerImageAsset,
  getImageAsset,
  updateImageAssetWidth,
  parseImageDimensionsFromBase64,
  extractQuestionImageIds,
  insertImageTokenAtCursor,
  removeImageTokenFromText,
  resolveImageTokensToMarkdown,
  maskImagesForAi,
  clearImageRegistryForTests,
} from '../src/utils/qbuilder-image';

// 1x1 pixel valid PNG in base64 (width=1, height=1)
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`;

test('parseImageDimensionsFromBase64 reads exact PNG IHDR width and height', () => {
  const dims = parseImageDimensionsFromBase64(TINY_PNG_BASE64, 'image/png');
  assert.deepEqual(dims, { width: 1, height: 1 });
});

test('registerImageAsset stores asset, extracts dimensions, and supports widthPct updates', () => {
  clearImageRegistryForTests();
  const asset = registerImageAsset(TINY_PNG_DATA_URL, 50, 'hinh_chop.png');
  assert.match(asset.id, /^img_[a-z0-9_]+$/);
  assert.equal(asset.width, 1);
  assert.equal(asset.height, 1);
  assert.equal(asset.widthPct, 50);
  assert.equal(getImageAsset(asset.id)?.dataUrl, TINY_PNG_DATA_URL);

  updateImageAssetWidth(asset.id, 75);
  assert.equal(getImageAsset(asset.id)?.widthPct, 75);
});

test('insertImageTokenAtCursor, extractQuestionImageIds, and removeImageTokenFromText work cleanly', () => {
  clearImageRegistryForTests();
  const asset = registerImageAsset(TINY_PNG_DATA_URL, 60);
  const initial = 'Cho hình chóp S.ABCD có đáy là hình vuông.\nA. 1\nB. 2';
  const pos = initial.indexOf('\nA.');
  const inserted = insertImageTokenAtCursor(initial, asset.id, pos, pos);

  assert.ok(inserted.text.includes(`![Hình minh họa](img:${asset.id})`));
  assert.deepEqual(extractQuestionImageIds(inserted.text), [asset.id]);

  const removed = removeImageTokenFromText(inserted.text, asset.id);
  assert.deepEqual(extractQuestionImageIds(removed), []);
  assert.equal(removed.trim(), initial.trim());
});

test('resolveImageTokensToMarkdown converts img:id tokens and raw data:image markdown into HTML img with data-width-pct', () => {
  clearImageRegistryForTests();
  const asset = registerImageAsset(TINY_PNG_DATA_URL, 40);
  const raw = `Tính thể tích khối chóp:\n![Hình 1](img:${asset.id})`;
  const resolved = resolveImageTokensToMarkdown(raw);
  assert.match(resolved, /<img\s+[^>]*src="data:image\/png;base64,/);
  assert.match(resolved, /data-width-pct="40"/);
  assert.match(resolved, /data-image-id="/);
});

test('maskImagesForAi replaces inline data:image URLs and img:id tokens with compact [[IMG_N]] markers and restores them', () => {
  clearImageRegistryForTests();
  const asset = registerImageAsset(TINY_PNG_DATA_URL, 50);
  const input = `Câu 1. Cho đồ thị như hình vẽ ![Hình](img:${asset.id}) và ảnh trực tiếp ![Ảnh 2](${TINY_PNG_DATA_URL}). Tìm cực trị.`;
  const { maskedText, restoreImages } = maskImagesForAi(input);

  assert.doesNotMatch(maskedText, /iVBORw0KGgo/);
  assert.match(maskedText, /\[\[IMG_0\]\]/);
  assert.match(maskedText, /\[\[IMG_1\]\]/);

  const restored = restoreImages(maskedText);
  const ids = extractQuestionImageIds(restored);
  assert.equal(ids.length, 2);
});

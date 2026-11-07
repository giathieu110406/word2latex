import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getXiaomiOcrUrl, callXiaomiOcr, checkXiaomiOcrHealth } from '../server/xiaomi-ocr-client.js';

test('getXiaomiOcrUrl respects environment variable or uses default', () => {
  const original = process.env.XIAOMI_OCR_URL;
  try {
    delete process.env.XIAOMI_OCR_URL;
    assert.equal(getXiaomiOcrUrl(), 'http://xiaomi-ocr:8000');

    process.env.XIAOMI_OCR_URL = 'http://192.168.1.100:8000/';
    assert.equal(getXiaomiOcrUrl(), 'http://192.168.1.100:8000');
  } finally {
    if (original !== undefined) {
      process.env.XIAOMI_OCR_URL = original;
    } else {
      delete process.env.XIAOMI_OCR_URL;
    }
  }
});

test('callXiaomiOcr returns null gracefully when service is unreachable (fallback trigger)', async () => {
  // Trỏ vào một port chắc chắn không có service lắng nghe
  process.env.XIAOMI_OCR_URL = 'http://127.0.0.1:59999';

  const dummyBuffer = Buffer.from('test buffer');
  const result = await callXiaomiOcr(dummyBuffer, 'test.png', 'image/png');

  assert.equal(result, null);
});

test('checkXiaomiOcrHealth returns false when service is unreachable', async () => {
  process.env.XIAOMI_OCR_URL = 'http://127.0.0.1:59999';
  const healthy = await checkXiaomiOcrHealth();
  assert.equal(healthy, false);
});

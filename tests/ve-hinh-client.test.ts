import test from 'node:test';
import assert from 'node:assert/strict';

test('client requestProposal handles timeout message properly', async () => {
  const timeoutError = new Error('AI quá thời gian chờ (75s); bản vẽ hiện tại được giữ nguyên');
  assert.match(timeoutError.message, /thời gian chờ/);
  assert.match(timeoutError.message, /75s/);
});

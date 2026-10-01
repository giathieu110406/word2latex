import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.Client_ID = 'test-client';
process.env.Api_Key = 'test-api';
process.env.Checksum_Key = 'test-checksum';
process.env.FIREBASE_API_KEY = 'test-firebase';
process.env.FIREBASE_PROJECT_ID = 'test-project';
const { default: handler } = await import('../api/payos-webhook.ts');
async function invoke(body: unknown) {
  let result: any;
  const res = { status() { return this; }, json(value: unknown) { result = value; return this; } };
  await handler({ method: 'POST', body } as any, res as any);
  return result;
}
// A failed signature must be caught before acknowledging the notification.
assert.equal((await invoke({ data: { code: '00' }, signature: 'invalid' })).success, false);
const data = { amount: 1000, code: '00', description: 'PAYOS_TEST', orderCode: 123 };
const signature = createHmac('sha256', 'test-checksum')
  .update('amount=1000&code=00&description=PAYOS_TEST&orderCode=123').digest('hex');
assert.equal((await invoke({ data, signature })).success, true);
console.log('PayOS webhook signature tests passed');

import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createEmailVerificationHandler } from '../api/email-verification.ts';
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'email integration test requires emulator, never production');
process.env.OTP_PEPPER = 'test-only-pepper';
const app = initializeApp({ projectId: 'demo-phone-confirmation' }, 'email-endpoint-test');
const db = getFirestore(app);
const uid = `endpoint-${Date.now()}`;
await db.collection('users').doc(uid).set({ planType: 'plus', phoneNumber: '' });
const sent: Array<{ to: string; text: string }> = [];
let smtpFails = false;
let claimsFail = false;
let now = new Date('2026-10-01T00:00:00Z');
const handler = createEmailVerificationHandler({
  getAdmin: () => ({ db, auth: {
    verifyIdToken: async token => { if (token !== 'valid') throw Error('bad token'); return { uid }; },
    getUser: async () => ({ providerData: [{ email: 'fixture@example.com' }], customClaims: { existing: true } }),
    setCustomUserClaims: async (_uid, claims) => { assert.equal(claims.existing, true); if (claimsFail) throw Error('claim unavailable'); },
  } }),
  createMailer: () => ({ sendMail: async message => { if (smtpFails) throw Error('SMTP unavailable'); sent.push(message); } }),
  now: () => now,
});
async function request(action: string, body: Record<string, unknown>, token = 'valid') {
  const result = { status: 0, body: {} as Record<string, unknown> };
  const response = { status: (code: number) => { result.status = code; return response; }, json: (data: Record<string, unknown>) => { result.body = data; return data; } };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, query: { action }, body }, response);
  return result;
}
assert.equal((await request('send', { phoneNumber: '0912345689' }, '')).status, 401);
assert.equal((await request('send', { phoneNumber: '0912345689' }, 'invalid')).status, 401);
assert.equal((await request('send', { phoneNumber: '0312345689' })).status, 400);
assert.equal((await request('send', { phoneNumber: '0912345689', email: 'attacker@example.com' })).status, 200);
assert.equal(sent[0].to, 'fixture@example.com', 'recipient comes from authenticated account, never body');
const otp = sent[0].text.match(/\b\d{6}\b/)![0];
const record = (await db.collection('email_verifications').doc(uid).get()).data()!;
assert.notEqual(record.otpHash, otp);
assert.equal(record.delivered, true);
assert.equal((await request('send', { phoneNumber: '0912345689' })).status, 429);
assert.equal((await request('verify', { code: '12' })).status, 400);
claimsFail = true;
const verified = await request('verify', { code: otp });
assert.equal(verified.status, 200, 'claim failure after commit does not reject confirmation');
assert.equal(verified.body.confirmedPhoneNumber, '+84912345689');
assert.equal((await db.collection('users').doc(uid).get()).data()?.planType, 'plus');
assert.equal((await request('verify', { code: otp })).status, 400, 'OTP cannot be replayed');
now = new Date(now.getTime() + 60000);
assert.equal((await request('send', { phoneNumber: '0335784563' })).status, 409, 'locked number cannot change');
smtpFails = true;
const failed = await request('send', { phoneNumber: '0912345689' });
assert.equal(failed.status, 503);
assert.equal((await db.collection('email_verifications').doc(uid).get()).data()?.delivered, false);
assert.equal((await request('verify', { code: otp })).status, 400, 'undelivered challenge is unusable');
assert.equal((await db.collection('users').doc(uid).collection('phoneConfirmations').get()).size, 1);
await deleteApp(app);
console.log('email confirmation endpoint integration tests passed');

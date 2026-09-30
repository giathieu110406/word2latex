import assert from 'node:assert/strict';

process.env.OTP_PEPPER = 'test-only-otp-pepper';

const moduleUnderTest = await import('./email-verification.ts').catch(() => null);
assert.ok(moduleUnderTest, 'email verification endpoint module must be available');

const { createEmailVerificationHandler, hashOtp } = moduleUnderTest;

type RecordData = Record<string, unknown>;
const verificationRecords = new Map<string, RecordData>();
const userProfiles = new Map<string, RecordData>();
const sentMessages: Array<{ to: string; text: string }> = [];
const claims = new Map<string, Record<string, unknown>>();
let currentTime = new Date('2026-09-30T00:00:00.000Z');

const store = {
  get: async (uid: string) => verificationRecords.get(uid) ?? null,
  set: async (uid: string, data: RecordData) => verificationRecords.set(uid, { ...data }),
  update: async (uid: string, data: RecordData) => verificationRecords.set(uid, { ...verificationRecords.get(uid), ...data }),
  delete: async (uid: string) => verificationRecords.delete(uid),
  setUser: async (uid: string, data: RecordData) => userProfiles.set(uid, { ...userProfiles.get(uid), ...data }),
};

const handler = createEmailVerificationHandler({
  getAdmin: () => ({
    auth: {
      verifyIdToken: async (token: string) => {
        if (token === 'missing-email-token') return { uid: 'user-2' };
        if (token !== 'valid-token') throw new Error('invalid token');
        return { uid: 'user-1', email: 'member@example.com' };
      },
      getUser: async (uid: string) => ({
        email: undefined,
        providerData: uid === 'user-2' ? [{ email: 'fallback@example.com', providerId: 'google.com' }] : [],
        customClaims: { existingClaim: true },
      }),
      setCustomUserClaims: async (uid: string, nextClaims: Record<string, unknown>) => claims.set(uid, nextClaims),
    },
    db: {},
  }),
  createStore: () => store,
  createMailer: () => ({
    sendMail: async ({ to, text }: { to: string; text: string }) => {
      sentMessages.push({ to, text });
    },
  }),
  now: () => currentTime,
});

function responseRecorder() {
  const result: { status?: number; body?: RecordData } = {};
  return {
    result,
    response: {
      status(status: number) {
        result.status = status;
        return this;
      },
      json(body: RecordData) {
        result.body = body;
        return body;
      },
    },
  };
}

const noToken = responseRecorder();
await handler({ method: 'POST', headers: {}, query: { action: 'send' }, body: { phoneNumber: '0901234567' } }, noToken.response);
assert.equal(noToken.result.status, 401);

const send = responseRecorder();
await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, query: { action: 'send' }, body: { phoneNumber: '0901234567' } }, send.response);
assert.equal(send.result.status, 200);
assert.equal(send.result.body?.cooldownSeconds, 60);
assert.equal(sentMessages.length, 1);
const storedRecord = verificationRecords.get('user-1');
assert.equal(storedRecord?.phoneNumber, '+84901234567');
assert.match(String(storedRecord?.otpHash), /^[a-f0-9]{64}$/);
const emailedOtp = sentMessages[0].text.match(/\b\d{6}\b/)?.[0];
assert.ok(emailedOtp, 'the email must contain a six-digit OTP');
assert.equal(String(storedRecord).includes(emailedOtp), false);

const fallbackEmail = responseRecorder();
await handler({ method: 'POST', headers: { authorization: 'Bearer missing-email-token' }, query: { action: 'send' }, body: { phoneNumber: '0901234567' } }, fallbackEmail.response);
assert.equal(fallbackEmail.result.status, 200);
assert.equal(sentMessages[1].to, 'fallback@example.com');

currentTime = new Date('2026-09-30T00:00:30.000Z');
const resendTooEarly = responseRecorder();
await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, query: { action: 'send' }, body: { phoneNumber: '0901234567' } }, resendTooEarly.response);
assert.equal(resendTooEarly.result.status, 429);
assert.equal(sentMessages.length, 2);

verificationRecords.set('user-1', {
  phoneNumber: '+84901234567',
  otpHash: hashOtp('user-1', '123456'),
  attempts: 0,
  lastSentAt: currentTime.toISOString(),
  expiresAt: '2026-09-30T00:10:00.000Z',
});
const verify = responseRecorder();
await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, query: { action: 'verify' }, body: { code: '123456' } }, verify.response);
assert.equal(verify.result.status, 200);
assert.equal(typeof userProfiles.get('user-1')?.emailOtpVerifiedAt, 'string');
assert.equal(userProfiles.get('user-1')?.phoneNumber, '+84901234567');
assert.equal(claims.get('user-1')?.emailOtpVerified, true);
assert.equal(claims.get('user-1')?.existingClaim, true);

verificationRecords.set('user-1', {
  phoneNumber: '+84901234567',
  otpHash: hashOtp('user-1', '123456'),
  attempts: 0,
  lastSentAt: currentTime.toISOString(),
  expiresAt: '2026-09-30T00:00:00.000Z',
});
const expired = responseRecorder();
await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, query: { action: 'verify' }, body: { code: '123456' } }, expired.response);
assert.equal(expired.result.status, 400);

verificationRecords.set('user-1', {
  phoneNumber: '+84901234567',
  otpHash: hashOtp('user-1', '123456'),
  attempts: 0,
  lastSentAt: currentTime.toISOString(),
  expiresAt: '2026-09-30T00:10:00.000Z',
});
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const wrongCode = responseRecorder();
  await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, query: { action: 'verify' }, body: { code: '000000' } }, wrongCode.response);
  assert.equal(wrongCode.result.status, attempt === 5 ? 429 : 400);
}
const sixthWrongCode = responseRecorder();
await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, query: { action: 'verify' }, body: { code: '000000' } }, sixthWrongCode.response);
assert.equal(sixthWrongCode.result.status, 429);

console.log('email verification endpoint tests passed');

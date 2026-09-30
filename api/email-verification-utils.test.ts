import assert from 'node:assert/strict';

process.env.OTP_PEPPER = 'test-only-otp-pepper';

const moduleUnderTest = await import('./email-verification-utils.ts').catch(() => null);

assert.ok(moduleUnderTest, 'OTP utility module must be available');

const { normalizeVietnamPhone, createOtp, hashOtp, isOtpExpired } = moduleUnderTest;

assert.equal(normalizeVietnamPhone('0901234567'), '+84901234567');
assert.equal(normalizeVietnamPhone('+84901234567'), '+84901234567');
assert.equal(normalizeVietnamPhone('0312345678'), '+84312345678');
assert.equal(normalizeVietnamPhone('0212345678'), null);

const otp = createOtp();
assert.match(otp, /^\d{6}$/);

const hash = hashOtp('user-1', '123456');
assert.notEqual(hash, '123456');
assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(hash, hashOtp('user-1', '123456'));
assert.notEqual(hash, hashOtp('user-2', '123456'));

const createdAt = new Date('2026-09-30T00:00:00.000Z');
assert.equal(isOtpExpired('2026-09-30T00:10:00.000Z', new Date(createdAt.getTime() + 9 * 60_000)), false);
assert.equal(isOtpExpired('2026-09-30T00:10:00.000Z', new Date(createdAt.getTime() + 10 * 60_000)), true);

console.log('email-verification utils tests passed');

import assert from 'node:assert/strict';

const moduleUnderTest = await import('./email-verification.ts').catch(() => null);
assert.ok(moduleUnderTest, 'email verification client utility must be available');

const { isEmailOtpVerified } = moduleUnderTest;

assert.equal(isEmailOtpVerified(null), false);
assert.equal(isEmailOtpVerified({}), false);
assert.equal(isEmailOtpVerified({ emailOtpVerifiedAt: '' }), false);
assert.equal(isEmailOtpVerified({ emailOtpVerifiedAt: 'not-a-date' }), false);
assert.equal(isEmailOtpVerified({ emailOtpVerifiedAt: '2026-09-30T00:00:00.000Z' }), true);
assert.equal(isEmailOtpVerified({ emailOtpVerifiedAt: new Date('2026-09-30T00:00:00.000Z') }), true);

console.log('email verification client utility tests passed');

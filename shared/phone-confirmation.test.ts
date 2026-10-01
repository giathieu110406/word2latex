import assert from 'node:assert/strict';
const policy = await import('./phone-confirmation.ts').catch(() => null);
assert.ok(policy, 'shared phone policy must be available');
const { normalizeVietnamPhone, hasPhoneConfirmation } = policy;
for (const input of ['0912345689', '+84 912.345.689', '(091) 234-5689']) {
  assert.equal(normalizeVietnamPhone(input), '+84912345689');
}
for (const input of ['', '0312345689', '0212345689', '091234568', '+840912345689', '091abcdefg', '0911111111', '0912345678', '0919876543']) {
  assert.equal(normalizeVietnamPhone(input), null, input);
}
assert.equal(normalizeVietnamPhone('0335784563'), '+84335784563');
assert.equal(normalizeVietnamPhone('0986888888'), '+84986888888', 'partial repetitions are valid');
for (const prefix of ['032','039','070','079','081','089','090','094','096','099','052','055','056','058','059','087']) {
  assert.ok(normalizeVietnamPhone(`${prefix}2345689`), prefix);
}
const profile = {
  phoneNumber: '0912345689', confirmedPhoneNumber: '+84912345689',
  emailOtpVerifiedAt: '2026-10-01T00:00:00Z', phoneConfirmedAt: '2026-10-01T00:00:00Z',
  phoneConfirmationMethod: 'email_otp', phoneConfirmationVersion: 1,
};
assert.equal(hasPhoneConfirmation(profile), true);
assert.equal(hasPhoneConfirmation({ emailOtpVerifiedAt: profile.emailOtpVerifiedAt }), false);
for (const overrides of [{ phoneNumber: '' }, { phoneNumber: '0335784563' }, { phoneConfirmedAt: 'invalid' }, { phoneConfirmationVersion: 0 }, { phoneConfirmationMethod: 'sms' }]) {
  assert.equal(hasPhoneConfirmation({ ...profile, ...overrides }), false);
}
console.log('phone confirmation policy tests passed');

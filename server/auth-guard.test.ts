import assert from 'node:assert/strict';
import { verifyAuthAndApproval } from './auth-guard.ts';

function request() {
  return { headers: { authorization: 'Bearer test-token' } };
}

function firestoreProfile(profile: Record<string, unknown>) {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => profile }),
      }),
    }),
  };
}

const ownerWithoutOtp = await verifyAuthAndApproval(
  request(),
  firestoreProfile({ status: 'approved', role: 'admin' }),
  async () => ({ uid: 'owner-1', email: 'giathieu110406@gmail.com' }),
);
assert.equal(ownerWithoutOtp.authorized, false);
assert.equal(ownerWithoutOtp.status, 403);

const memberWithoutOtp = await verifyAuthAndApproval(
  request(),
  firestoreProfile({ status: 'approved', role: 'user' }),
  async () => ({ uid: 'member-1', email: 'member@example.com' }),
);
assert.equal(memberWithoutOtp.authorized, false);
assert.equal(memberWithoutOtp.status, 403);

const verifiedMember = await verifyAuthAndApproval(
  request(),
  firestoreProfile({ status: 'approved', role: 'user', emailOtpVerifiedAt: '2026-09-30T00:00:00.000Z', phoneNumber: '+84912345689', confirmedPhoneNumber: '+84912345689', phoneConfirmedAt: '2026-09-30T00:00:00.000Z', phoneConfirmationMethod: 'email_otp', phoneConfirmationVersion: 1 }),
  async () => ({ uid: 'member-1', email: 'member@example.com' }),
);
assert.equal(verifiedMember.authorized, true);
assert.equal(verifiedMember.status, 200);

const oldProfile = await verifyAuthAndApproval(request(), firestoreProfile({ status: 'approved', emailOtpVerifiedAt: '2026-09-30T00:00:00Z' }), async () => ({ uid: 'member-1', email: 'member@example.com' }));
assert.equal(oldProfile.authorized, false, 'date alone cannot bypass phone confirmation');
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => ({ ok: false })) as typeof fetch;
const forged = `e30.${Buffer.from(JSON.stringify({ sub: 'owner-1', email: 'giathieu110406@gmail.com', aud: 'word2latex-prod-fde7b', iss: 'https://securetoken.google.com/word2latex-prod-fde7b', exp: 9999999999 })).toString('base64url')}.fake`;
const forgedResult = await verifyAuthAndApproval({ headers: { authorization: `Bearer ${forged}` } }, firestoreProfile({ status: 'approved', emailOtpVerifiedAt: '2026-09-30T00:00:00Z' }));
assert.equal(forgedResult.status, 401, 'unsigned token is rejected rather than decoded as authentication');
globalThis.fetch = originalFetch;

console.log('auth guard email OTP tests passed');

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
  firestoreProfile({ status: 'approved', role: 'user', emailOtpVerifiedAt: '2026-09-30T00:00:00.000Z' }),
  async () => ({ uid: 'member-1', email: 'member@example.com' }),
);
assert.equal(verifiedMember.authorized, true);
assert.equal(verifiedMember.status, 200);

console.log('auth guard email OTP tests passed');

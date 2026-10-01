import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireTools = createRequire(new URL('../scratch/firebase-tests/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = requireTools('@firebase/rules-unit-testing');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rules test requires emulator, never production');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-phone-confirmation', firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
const uid = `rules-${Date.now()}`;
await env.withSecurityRulesDisabled(async (context: any) => {
  await context.firestore().doc(`users/${uid}`).set({ role: 'user', status: 'approved', phoneNumber: '+84912345689', confirmedPhoneNumber: '+84912345689', emailOtpVerifiedAt: '2026-10-01T00:00:00Z', phoneConfirmationMethod: 'email_otp', phoneConfirmationVersion: 1 });
  await context.firestore().doc(`users/${uid}/phoneConfirmations/one`).set({ phoneNumber: '+84912345689' });
});
const member = env.authenticatedContext(uid, { email: 'fixture@example.com' }).firestore();
const owner = env.authenticatedContext('owner-test', { email: 'giathieu110406@gmail.com' }).firestore();
await assertSucceeds(member.doc(`users/${uid}`).update({ displayName: 'Updated', birthDate: '2000-01-01' }));
for (const fields of [{ phoneNumber: '' }, { confirmedPhoneNumber: '+84335784563' }, { phoneConfirmationVersion: 0 }, { phoneHistory: ['fake'] }, { emailOtpVerifiedAt: 'new' }]) {
  await assertFails(member.doc(`users/${uid}`).update(fields));
  await assertFails(owner.doc(`users/${uid}`).update(fields));
}
await assertFails(member.doc(`users/${uid}/phoneConfirmations/fake`).set({ method: 'email_otp' }));
await assertFails(owner.doc(`users/${uid}/phoneConfirmations/fake`).set({ method: 'email_otp' }));
await assertFails(member.doc(`users/${uid}/phoneConfirmations/one`).get());
await assertSucceeds(owner.doc(`users/${uid}/phoneConfirmations/one`).get());
await assertFails(owner.doc(`email_verifications/${uid}`).set({ otpHash: 'fake' }));
const newUid = `new-${uid}`;
const newMember = env.authenticatedContext(newUid).firestore();
await assertFails(newMember.doc(`users/${newUid}`).set({ role: 'user', status: 'pending', confirmedPhoneNumber: '+84912345689', phoneConfirmationVersion: 1 }));
await assertSucceeds(newMember.doc(`users/${newUid}`).set({ role: 'user', status: 'pending', phoneNumber: '' }));
await env.cleanup();
console.log('phone confirmation Firestore rules tests passed');

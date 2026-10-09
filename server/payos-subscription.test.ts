import assert from 'node:assert/strict';
import { activatePaidPlan, findPaymentUser } from './payos-subscription.ts';

const records = new Map<string, any>([['users/user-1', { planType: 'free' }]]);
const db = {
  collection: (name: string) => ({ doc: (id: string) => ({ key: `${name}/${id}` }) }),
  runTransaction: async (fn: any) => fn({
    get: async (ref: any) => ({ exists: records.has(ref.key), data: () => records.get(ref.key) }),
    update: (ref: any, value: any) => records.set(ref.key, { ...records.get(ref.key), ...value }),
    set: (ref: any, value: any) => records.set(ref.key, value),
  }),
};
await activatePaidPlan(db as any, 'user-1', 123, 9000);
assert.equal(records.get('users/user-1').planType, 'trial');
const paymentEvents=[...records.entries()].filter(([key])=>key.startsWith('activity_events/'));
assert.equal(paymentEvents.length,1);
assert.equal(paymentEvents[0][1].actorType,'system');
assert.equal(paymentEvents[0][1].actorUid,null);
assert.equal(paymentEvents[0][1].targetUid,'user-1');
const expires = records.get('users/user-1').planExpiresAt;
assert.ok(expires >= Date.now() + 6.99 * 86400000);
await activatePaidPlan(db as any, 'user-1', 123, 9000);
assert.equal(records.get('users/user-1').planExpiresAt, expires);
await assert.rejects(activatePaidPlan(db as any, 'user-2', 123, 9000));
await assert.rejects(activatePaidPlan(db as any, 'user-1', 124, 1000));
const userDb = (ids: string[]) => ({ collection: () => ({ get: async () => ({ docs: ids.map(id => ({ id })) }) }) });
assert.equal(await findPaymentUser(userDb(['abcd-user']) as any, 'BANK W2LABCD'), 'abcd-user');
await assert.rejects(findPaymentUser(userDb(['abcd-1', 'abcd-2']) as any, 'W2LABCD'));
console.log('Paid plan activation and duplicate notification tests passed');

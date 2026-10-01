import type { Firestore } from 'firebase-admin/firestore';

export async function findPaymentUser(db: Firestore, description: string) {
  const prefix = description.match(/W2L([A-Z0-9]{4})(?![A-Z0-9])/i)?.[1]?.toLowerCase();
  if (!prefix) throw new Error('Payment description has no user reference');
  // Legacy orders contain only four UID characters; ambiguous matches must not activate a user.
  const users = await db.collection('users').get();
  const matches = users.docs.filter(user => user.id.toLowerCase().startsWith(prefix));
  if (matches.length !== 1) throw new Error('Payment user reference is missing or ambiguous');
  return matches[0].id;
}

export async function activatePaidPlan(db: Firestore, uid: string, orderCode: number, amount: number) {
  const plan = amount === 9000 ? 'trial' : amount === 19000 ? 'plus' : amount === 29000 ? 'pro' : null;
  if (!plan || !Number.isSafeInteger(orderCode)) throw new Error('Invalid paid order');
  const userRef = db.collection('users').doc(uid);
  const paymentRef = db.collection('payosPayments').doc(String(orderCode));
  await db.runTransaction(async transaction => {
    const payment = await transaction.get(paymentRef);
    if (payment.exists) {
      if (payment.data()?.uid !== uid) throw new Error('Order already assigned');
      return;
    }
    const user = await transaction.get(userRef);
    if (!user.exists) throw new Error('Payment user not found');
    const now = Date.now();
    transaction.update(userRef, {
      planType: plan, pricingPlan: plan,
      planExpiresAt: now + (plan === 'trial' ? 7 : 30) * 86400000,
      updatedAt: new Date(now).toISOString(),
    });
    transaction.set(paymentRef, { uid, amount, plan, activatedAt: now });
  });
}

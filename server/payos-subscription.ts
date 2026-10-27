import type { Firestore } from 'firebase-admin/firestore';
import { activityId, activityData } from './activity.js';
import type { ActivitySource } from '../shared/activity.js';

export async function findPaymentUser(db: Firestore, description: string) {
  const prefix = description.match(/W2L([A-Z0-9]{4})(?![A-Z0-9])/i)?.[1]?.toLowerCase();
  if (!prefix) throw new Error('Payment description has no user reference');
  // Legacy orders contain only four UID characters; ambiguous matches must not activate a user.
  const users = await db.collection('users').get();
  const matches = users.docs.filter(user => user.id.toLowerCase().startsWith(prefix));
  if (matches.length !== 1) throw new Error('Payment user reference is missing or ambiguous');
  return matches[0].id;
}

export async function activatePaidPlan(db: Firestore, uid: string, orderCode: number, amount: number, source: ActivitySource='web') {
  const plan = (amount === 9000 || amount === 12000 || amount === 13000 || amount === 78000) ? 'plus' : (amount === 5000 || amount === 7000) ? 'trial' : (amount === 15000 || amount === 17000 || amount === 19000 || amount === 29000 || amount === 49000 || amount === 102000) ? 'pro' : null;
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
    const isAnnual = amount === 78000 || amount === 90000 || amount === 102000;
    const durationDays = plan === 'trial' ? 12 : isAnnual ? 365 : 30; // TRIAL: 12 ngày, Tháng: 30 ngày, Năm: 365 ngày
    transaction.update(userRef, {
      planType: plan, pricingPlan: plan,
      hasUsedTrial: plan === 'trial' ? true : user.data()?.hasUsedTrial || false,
      hasSubscribedPlus: (plan === 'plus' || user.data()?.hasSubscribedPlus) ? true : false,
      planExpiresAt: now + durationDays * 86400000,
      updatedAt: new Date(now).toISOString(),
    });
    transaction.set(paymentRef, { uid, amount, plan, activatedAt: now });
    // Audit and payment commit together; duplicate webhook/check cannot create a second activation event.
    const action='Thanh toán: kích hoạt gói';
    transaction.set(db.collection('activity_events').doc(activityId(null,String(orderCode),action)),
      activityData({actorUid:null,actorType:'system',action,source,status:'success',targetUid:uid,referenceId:String(orderCode)},new Date(now)));
  });
}

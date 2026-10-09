import { VercelRequest, VercelResponse } from '@vercel/node';
import { PayOS } from "@payos/node";
import { getFirebaseAdmin } from '../server/firebase-admin.js';
import { activatePaidPlan, findPaymentUser } from '../server/payos-subscription.js';
import { requestSource } from '../server/activity.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' });
  }

  let payos: any = null;
  if ((process.env.PAYOS_CLIENT_ID || process.env.Client_ID) && (process.env.PAYOS_API_KEY || process.env.Api_Key) && (process.env.PAYOS_CHECKSUM_KEY || process.env.Checksum_Key)) {
    payos = new PayOS({ clientId: process.env.PAYOS_CLIENT_ID || process.env.Client_ID, apiKey: process.env.PAYOS_API_KEY || process.env.Api_Key, checksumKey: process.env.PAYOS_CHECKSUM_KEY || process.env.Checksum_Key });
  } else {
    return res.status(500).json({ error: "PayOS chưa cấu hình" });
  }

  try {
    const { orderCode } = req.body;
    if (!orderCode) {
      return res.status(400).json({ error: "Thiếu orderCode" });
    }

    const paymentInfo = await payos.paymentRequests.get(orderCode);
    console.log("PayOS check paymentInfo:", paymentInfo.status);

    if (paymentInfo.status === "PAID") {
      const { db } = getFirebaseAdmin();
      const description = paymentInfo.transactions?.find((transaction: any) => /W2L/i.test(transaction.description))?.description || '';
      const uid = await findPaymentUser(db, description);
      await activatePaidPlan(db, uid, Number(orderCode), paymentInfo.amount, requestSource(req,null));
      return res.json({ paid: true, status: paymentInfo.status });
    }

    return res.json({ paid: false, status: paymentInfo.status });
  } catch (error: any) {
    console.error("PayOS status check error:", error);
    return res.status(500).json({ error: error.message });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { PayOS } from "@payos/node";
import { getFirebaseAdmin } from '../server/firebase-admin.js';
import { activatePaidPlan, findPaymentUser } from '../server/payos-subscription.js';
import { requestSource } from '../server/activity.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // PayOS test webhook thường gửi request GET hoặc HEAD để ping kiểm tra URL có sống không
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({ status: 'ok', message: 'PayOS webhook endpoint is active' });
  }

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
    const webhookData = await payos.webhooks.verify(req.body);
    console.log("PayOS Webhook Received:", webhookData);

    if (webhookData.code === "00") {
      const description = webhookData.description || "";
      if (/W2L/i.test(description)) {
        const { db } = getFirebaseAdmin();
        const uid = await findPaymentUser(db, description);
        await activatePaidPlan(db, uid, webhookData.orderCode, webhookData.amount, requestSource(req,null));
      }
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error("PayOS Webhook Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

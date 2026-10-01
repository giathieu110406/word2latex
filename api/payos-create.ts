import { VercelRequest, VercelResponse } from '@vercel/node';
import { PayOS } from "@payos/node";
import { getFirebaseAdmin } from '../server/firebase-admin.js';
import { canRegisterPlan } from '../shared/subscription-policy.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let payos: any = null;
  if ((process.env.PAYOS_CLIENT_ID || process.env.Client_ID) && (process.env.PAYOS_API_KEY || process.env.Api_Key) && (process.env.PAYOS_CHECKSUM_KEY || process.env.Checksum_Key)) {
    payos = new PayOS({ clientId: process.env.PAYOS_CLIENT_ID || process.env.Client_ID, apiKey: process.env.PAYOS_API_KEY || process.env.Api_Key, checksumKey: process.env.PAYOS_CHECKSUM_KEY || process.env.Checksum_Key });
  } else {
    return res.status(500).json({ error: "PayOS chưa được cấu hình trên Server (.env)" });
  }

  try {
    const { plan } = req.body;
    const amount = ({ trial: 9000, plus: 19000, pro: 29000 } as Record<string, number>)[plan];
    if (!amount) {
      return res.status(400).json({ error: "Gói đăng ký không hợp lệ." });
    }
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
    const { auth, db } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(header.slice(7)).catch(() => null);
    if (!decoded) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    const uid = decoded.uid;
    const profile = (await db.collection('users').doc(uid).get()).data();
    if (!profile) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (!canRegisterPlan(plan, profile.planType, profile.planExpiresAt)) {
      return res.status(409).json({ error: 'Bạn đã đăng ký gói này hoặc gói cao hơn. Vui lòng chờ gói hiện tại hết hạn.' });
    }
    
    // Tạo orderCode từ Date + random
    const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));
    
    const body = {
      orderCode,
      amount,
      description: `W2L${uid.substring(0, 4).toUpperCase()}`, // max 25 chars
      returnUrl: `${req.headers.origin || "http://localhost:3000"}?payment=success`,
      cancelUrl: `${req.headers.origin || "http://localhost:3000"}?payment=cancelled`
    };

    const paymentLinkRes = await payos.paymentRequests.create(body);
    return res.status(200).json({
      checkoutUrl: paymentLinkRes.checkoutUrl,
      qrCode: paymentLinkRes.qrCode,
      bin: paymentLinkRes.bin,
      accountNumber: paymentLinkRes.accountNumber,
      amount: paymentLinkRes.amount,
      description: paymentLinkRes.description,
      orderCode: orderCode
    });
  } catch (error: any) {
    console.error("Lỗi tạo Payment Link:", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}

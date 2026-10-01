import { VercelRequest, VercelResponse } from '@vercel/node';
import { PayOS } from "@payos/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let payos: any = null;
  if (process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY) {
    payos = new PayOS(process.env.PAYOS_CLIENT_ID, process.env.PAYOS_API_KEY, process.env.PAYOS_CHECKSUM_KEY);
  } else {
    return res.status(500).json({ error: "PayOS chưa được cấu hình trên Server (.env)" });
  }

  try {
    const { amount, plan, uid } = req.body;
    if (!amount || !plan || !uid) {
      return res.status(400).json({ error: "Thiếu dữ liệu (amount, plan, uid)" });
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

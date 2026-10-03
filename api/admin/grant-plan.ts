import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../server/admin-request.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const context = await requireAdmin(req, res);
    if (!context) return;

    const { decodedToken, db } = context;
    const { targetUid, plan, durationDays, note } = req.body || {};
    if (typeof targetUid !== 'string' || !targetUid || !['free', 'trial', 'plus', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Thông tin người dùng hoặc gói không hợp lệ' });
    }

    const targetUserRef = db.collection('users').doc(targetUid);
    const targetUserSnap = await targetUserRef.get();
    if (!targetUserSnap.exists) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const now = Date.now();
    const days = Number(durationDays) || (plan === 'trial' ? 7 : 30);
    const planExpiresAt = plan === 'free' ? null : now + days * 86400000;
    await targetUserRef.update({
      planType: plan,
      pricingPlan: plan,
      planExpiresAt,
      status: 'approved',
      updatedAt: new Date(now).toISOString(),
    });

    const orderCode = `ADMIN_${now}`;
    await db.collection('payosPayments').doc(orderCode).set({
      uid: targetUid,
      amount: 0,
      plan,
      activatedAt: now,
      method: 'admin_grant',
      grantedBy: decodedToken.email || decodedToken.uid,
      note: note || 'Cấp bởi Quản trị viên',
    });

    return res.status(200).json({
      success: true,
      message: `Đã cấp gói ${plan.toUpperCase()} thành công và ghi nhận vào lịch sử thanh toán (0đ).`,
      orderCode,
      planExpiresAt,
    });
  } catch (error: any) {
    console.error('Lỗi /api/admin/grant-plan:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}

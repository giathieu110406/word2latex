import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../server/admin-request.js';
import { randomUUID } from 'node:crypto';
import { grantPlan } from '../../server/admin-plan.js';
import { requestSource } from '../../server/activity.js';

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

    const headerId=req.headers['x-activity-id'];
    const requestId=typeof headerId==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(headerId)?headerId:randomUUID();
    const {orderCode,planExpiresAt}=await grantPlan(db,decodedToken.uid,requestId,{targetUid,plan,durationDays,note},requestSource(req,{role:'admin'}));

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

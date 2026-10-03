import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../server/admin-request.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const context = await requireAdmin(req, res);
    if (!context) return;

    const snapshot = await context.db.collection('payosPayments').get();
    const payments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    payments.sort((a: any, b: any) => (b.activatedAt || 0) - (a.activatedAt || 0));
    return res.status(200).json(payments);
  } catch (error: any) {
    console.error('Lỗi /api/admin/payments:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}

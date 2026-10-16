import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../server/admin-request.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
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

  if (req.method === 'DELETE') {
    try {
      const context = await requireAdmin(req, res);
      if (!context) return;

      const paymentId = (req.query?.id as string) || (req.body?.id as string);
      if (!paymentId || typeof paymentId !== 'string') {
        return res.status(400).json({ error: 'Mã giao dịch không hợp lệ' });
      }

      const docRef = context.db.collection('payosPayments').doc(paymentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: 'Không tìm thấy giao dịch này' });
      }

      const data = docSnap.data() || {};
      const isAdminGrant = data.method === 'admin_grant' || (Number(data.amount) === 0 && paymentId.startsWith('ADMIN_'));
      if (!isAdminGrant) {
        return res.status(403).json({ error: 'Chỉ có thể xóa giao dịch do Admin cấp. Không thể xóa giao dịch PayOS.' });
      }

      await docRef.delete();
      return res.status(200).json({ success: true, message: 'Đã xóa giao dịch admin cấp thành công' });
    } catch (error: any) {
      console.error('Lỗi DELETE /api/admin/payments:', error);
      return res.status(500).json({ error: error?.message || 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

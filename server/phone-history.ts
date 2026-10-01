import type { Firestore } from 'firebase-admin/firestore';
import { normalizeVietnamPhone } from '../shared/phone-confirmation.js';
import { ConfirmationError } from './phone-confirmation-store.js';

export async function readPhoneHistory(db: Firestore, actorUid: string, actorEmail: string, targetUid: string) {
  if (!targetUid || targetUid.length > 128 || /[/\x00-\x1f]/.test(targetUid)) {
    throw new ConfirmationError(400, 'INVALID_UID', 'Mã thành viên không hợp lệ.');
  }
  if (actorEmail.toLowerCase() !== 'giathieu110406@gmail.com') {
    const [actor, admin] = await Promise.all([
      db.collection('users').doc(actorUid).get(), db.collection('admins').doc(actorUid).get(),
    ]);
    if (actor.data()?.role !== 'admin' && !admin.exists) {
      throw new ConfirmationError(403, 'ADMIN_REQUIRED', 'Chỉ quản trị viên được xem lịch sử số liên hệ.');
    }
  }
  const ref = db.collection('users').doc(targetUid);
  const profile = await ref.get();
  if (!profile.exists) throw new ConfirmationError(404, 'USER_NOT_FOUND', 'Không tìm thấy thành viên.');
  const history = await ref.collection('phoneConfirmations').orderBy('confirmedAt', 'desc').limit(100).get();
  const phone = normalizeVietnamPhone(String(profile.data()?.confirmedPhoneNumber || profile.data()?.phoneNumber || ''));
  let duplicatePhone = false;
  if (phone) {
    const [confirmed, legacy] = await Promise.all([
      db.collection('users').where('confirmedPhoneNumber', '==', phone).limit(2).get(),
      db.collection('users').where('phoneNumber', 'in', [phone, `0${phone.slice(3)}`]).limit(2).get(),
    ]);
    // Legacy numbers with arbitrary separators may be missed; all new confirmations are canonical.
    duplicatePhone = [...confirmed.docs, ...legacy.docs].some(user => user.id !== targetUid);
  }
  return { events: history.docs.map(event => ({ id: event.id, ...event.data() })), duplicatePhone };
}

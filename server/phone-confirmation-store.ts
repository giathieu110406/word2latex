import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';
import { normalizeVietnamPhone, type ConfirmedPhoneProfile } from '../shared/phone-confirmation.js';

export class ConfirmationError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

function checkLockedPhone(profile: Record<string, unknown>, phone: string) {
  // Cho phép người dùng đổi số điện thoại tự do
  return;
}

export function createPhoneConfirmationStore(db: Firestore) {
  return {
    async reserveSend(uid: string, phone: string, email: string, challengeId: string, otpHash: string, now: Date) {
      if (normalizeVietnamPhone(phone) !== phone) throw new ConfirmationError(400, 'INVALID_PHONE', 'Số di động không hợp lệ hoặc có mẫu số không được chấp nhận.');
      const nowMs = now.getTime();
      const recordRef = db.collection('email_verifications').doc(uid);
      await db.runTransaction(async tx => {
        const user = await tx.get(db.collection('users').doc(uid));
        const snapshot = await tx.get(recordRef);
        if (!user.exists) throw new ConfirmationError(409, 'PROFILE_MISSING', 'Hồ sơ chưa sẵn sàng. Vui lòng tải lại trang.');
        checkLockedPhone(user.data()!, phone);
        const previous = snapshot.data() ?? {};
        const sendTimes: number[] = Array.isArray(previous.sendTimes)
          ? previous.sendTimes.filter((time: unknown): time is number => typeof time === 'number' && time > nowMs - 86400000) : [];
        const remainingMs = Number(previous.lastSentAtMs ?? 0) + 60000 - nowMs;
        if (remainingMs > 0) throw new ConfirmationError(429, 'RESEND_COOLDOWN', 'Vui lòng chờ trước khi gửi lại mã.', { cooldownSeconds: Math.ceil(remainingMs / 1000) });
        const hourly = sendTimes.filter(time => time > nowMs - 3600000);
        if (sendTimes.length >= 10 || hourly.length >= 5) {
          const daily = sendTimes.length >= 10;
          const resetAt = Math.min(...(daily ? sendTimes : hourly)) + (daily ? 86400000 : 3600000);
          throw new ConfirmationError(429, 'SEND_LIMIT', daily ? 'Đã đạt giới hạn 10 lần gửi trong 24 giờ.' : 'Đã đạt giới hạn 5 lần gửi trong một giờ.', { cooldownSeconds: Math.ceil((resetAt - nowMs) / 1000) });
        }
        // A failed SMTP attempt still spends a rate-limit slot; it never becomes usable.
        tx.set(recordRef, {
          challengeId, phoneNumber: phone, email, otpHash, delivered: false, consumed: false,
          attempts: 0, expiresAtMs: nowMs + 600000, lastSentAtMs: nowMs, sendTimes: [...sendTimes, nowMs],
        });
      });
    },
    async markDelivered(uid: string, challengeId: string) {
      const ref = db.collection('email_verifications').doc(uid);
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (snapshot.data()?.challengeId !== challengeId || snapshot.data()?.consumed) {
          throw new ConfirmationError(409, 'CHALLENGE_REPLACED', 'Mã này đã được thay thế. Vui lòng dùng email mới nhất.');
        }
        tx.update(ref, { delivered: true });
      });
    },
    async verify(uid: string, email: string, codeHash: string, now: Date): Promise<ConfirmedPhoneProfile> {
      const userRef = db.collection('users').doc(uid);
      const recordRef = db.collection('email_verifications').doc(uid);
      const result = await db.runTransaction(async tx => {
        const user = await tx.get(userRef);
        const snapshot = await tx.get(recordRef);
        const record = snapshot.data();
        if (!record || record.consumed) throw new ConfirmationError(400, 'OTP_NOT_REQUESTED', 'Vui lòng yêu cầu mã mới; mã hiện tại đã dùng hoặc chưa được yêu cầu.');
        if (!record.delivered || record.email !== email) throw new ConfirmationError(400, 'EMAIL_CHANGED', 'Mã chưa được gửi thành công hoặc email tài khoản đã thay đổi. Vui lòng yêu cầu mã mới.');
        if (!Number.isFinite(record.expiresAtMs) || record.expiresAtMs <= now.getTime()) throw new ConfirmationError(400, 'OTP_EXPIRED', 'Mã đã hết hạn. Vui lòng yêu cầu mã mới.');
        if (Number(record.attempts) >= 5) throw new ConfirmationError(429, 'OTP_LOCKED', 'Đã nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.');
        const expected = Buffer.from(String(record.otpHash ?? ''));
        const actual = Buffer.from(codeHash);
        if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
          const attempts = Number(record.attempts ?? 0) + 1;
          tx.update(recordRef, { attempts });
          // Throw outside transaction so the failed attempt is committed.
          return { error: new ConfirmationError(attempts >= 5 ? 429 : 400, attempts >= 5 ? 'OTP_LOCKED' : 'INVALID_OTP', attempts >= 5 ? 'Đã nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.' : 'Mã xác nhận không đúng.') };
        }
        const phone = normalizeVietnamPhone(String(record.phoneNumber ?? ''));
        if (!phone || !user.exists) throw new ConfirmationError(400, 'INVALID_PROFILE', 'Số liên hệ hoặc hồ sơ không hợp lệ.');
        checkLockedPhone(user.data()!, phone);
        const verifiedAt = now.toISOString();
        const profile: ConfirmedPhoneProfile = {
          phoneNumber: phone, confirmedPhoneNumber: phone,
          emailOtpVerifiedAt: verifiedAt, phoneConfirmedAt: verifiedAt,
          phoneConfirmationMethod: 'email_otp', phoneConfirmationVersion: 1,
        };
        tx.update(userRef, { ...profile });
        tx.set(userRef.collection('phoneConfirmations').doc(String(record.challengeId)), {
          phoneNumber: phone, email, confirmedAt: verifiedAt, method: 'email_otp', version: 1,
        });
        tx.update(recordRef, { consumed: true, delivered: false, otpHash: FieldValue.delete() });
        return { profile };
      });
      if (result.error) throw result.error;
      return result.profile!;
    },
  };
}

export type PhoneConfirmationStore = ReturnType<typeof createPhoneConfirmationStore>;

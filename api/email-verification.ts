import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { getFirebaseAdmin } from '../server/firebase-admin.js';
import { createOtp, hashOtp, normalizeVietnamPhone } from '../server/email-verification-utils.js';
import { randomUUID } from 'node:crypto';
import { ConfirmationError, createPhoneConfirmationStore, type PhoneConfirmationStore } from '../server/phone-confirmation-store.js';
import { readPhoneHistory } from '../server/phone-history.js';
import type { Firestore } from 'firebase-admin/firestore';

export { hashOtp } from '../server/email-verification-utils.js';

type RecordData = Record<string, unknown>;

export interface RequestLike {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: RecordData): unknown;
}

export interface EmailOtpAuth {
  verifyIdToken(token: string): Promise<{ uid: string; email?: string }>;
  getUser(uid: string): Promise<{
    email?: string;
    providerData?: Array<{ email?: string; providerId?: string }>;
    customClaims?: Record<string, unknown>;
  }>;
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
}

export interface EmailVerificationHandlerDependencies {
  getAdmin?: () => { auth: EmailOtpAuth; db: Firestore };
  createStore?: (db: any) => PhoneConfirmationStore;
  createMailer?: () => { sendMail(message: { to: string; subject: string; text: string; html: string }): Promise<unknown> };
  now?: () => Date;
}

const EndpointError = ConfirmationError;

export function createMailer() {
  let transportConfig: any;

  if (process.env.SMTP_URL) {
    // Ưu tiên đọc từ 1 biến duy nhất nếu user cấu hình
    transportConfig = process.env.SMTP_URL;
  } else {
    // Fallback đọc cấu hình rời rạc (cũ)
    const user = process.env.SMTP_USER || process.env.SMTP_GMAIL;
    const password = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
    const host = process.env.SMTP_HOST || (user ? 'smtp.gmail.com' : '');
    
    if (!host || !user || !password) {
      const missing = [!host && 'SMTP_HOST', !user && 'SMTP_USER', !password && 'SMTP_APP_PASSWORD']
        .filter(Boolean).join(', ');
      throw new EndpointError(503, 'SMTP_UNAVAILABLE', `Dịch vụ gửi email chưa được cấu hình (thiếu: ${missing}).`);
    }

    transportConfig = {
      host,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
      auth: { user, pass: password },
    };
  }

  const transport = nodemailer.createTransport(transportConfig);
  // Email người gửi (ưu tiên SMTP_FROM, nếu không có thì lấy phần user của URL/Username)
  let from = process.env.SMTP_FROM;
  if (!from && typeof transportConfig === 'object') {
    from = transportConfig.auth?.user;
  }
  
  return {
    transport,
    sendMail(message: { to: string; subject: string; text: string; html: string }) {
      return transport.sendMail({ ...message, from });
    },
  };

}

function getBearerToken(req: RequestLike): string | null {
  const value = req.headers?.authorization ?? req.headers?.Authorization;
  const header = Array.isArray(value) ? value[0] : value;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function getAction(req: RequestLike): string | null {
  const action = req.query?.action ?? req.body?.action;
  return typeof action === 'string' ? action : null;
}

function getFirebaseAccountEmail(
  decoded: { email?: string },
  user: { email?: string; providerData?: Array<{ email?: string }> },
): string | null {
  const candidates = [
    user.email,
    ...(user.providerData?.map((provider) => provider.email) ?? []),
    decoded.email,
  ];
  return candidates.find((candidate): candidate is string => (
    typeof candidate === 'string' && /^\S+@\S+\.\S+$/.test(candidate.trim())
  ))?.trim() ?? null;
}

export function createEmailVerificationHandler(dependencies: EmailVerificationHandlerDependencies = {}) {
  const getAdmin = dependencies.getAdmin ?? getFirebaseAdmin;
  const now = dependencies.now ?? (() => new Date());

  return async function emailVerificationHandler(req: RequestLike, res: ResponseLike): Promise<unknown> {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const token = getBearerToken(req);
      if (!token) {
        throw new EndpointError(401, 'UNAUTHENTICATED', 'Bạn chưa đăng nhập. Vui lòng đăng nhập lại.');
      }

      const { auth, db } = (() => {
        try {
          return getAdmin();
        } catch (adminErr: unknown) {
          const msg = adminErr instanceof Error ? adminErr.message : String(adminErr);
          throw new EndpointError(503, 'ADMIN_UNAVAILABLE', `Lỗi cấu hình server: ${msg}`);
        }
      })();
      const decoded = await auth.verifyIdToken(token).catch(() => {
        throw new EndpointError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      });
      if (!decoded.uid) {
        throw new EndpointError(401, 'UNAUTHENTICATED', 'Token xác thực không có địa chỉ email hợp lệ.');
      }
      const firebaseUser = await auth.getUser(decoded.uid);
      const email = getFirebaseAccountEmail(decoded, firebaseUser);
      if (!email) {
        throw new EndpointError(401, 'UNAUTHENTICATED', 'Tài khoản không có địa chỉ email hợp lệ.');
      }

      const action = getAction(req);
      if (action === 'history') {
        const history = await readPhoneHistory(db, decoded.uid, email, String(req.body?.targetUid ?? ''));
        return res.status(200).json({ success: true, ...history });
      }
      const store = (dependencies.createStore ?? createPhoneConfirmationStore)(db);
      const mailer = dependencies.createMailer ?? createMailer;
      const currentTime = now();

      if (action === 'send') {
        const phoneNumber = normalizeVietnamPhone(String(req.body?.phoneNumber ?? ''));
        if (!phoneNumber) {
          throw new EndpointError(400, 'INVALID_PHONE', 'Số di động Việt Nam không hợp lệ hoặc có mẫu số không được chấp nhận.');
        }

        const otp = createOtp();
        const otpHash = hashOtp(decoded.uid, otp);
        const challengeId = randomUUID();
        const sender = mailer();
        await store.reserveSend(decoded.uid, phoneNumber, email, challengeId, otpHash, currentTime);
        await sender.sendMail({
          to: email,
          subject: 'Mã xác thực Word2LaTeX',
          text: `Mã xác nhận Word2LaTeX của bạn là ${otp}. Mã hết hạn sau 10 phút. Số liên hệ ${phoneNumber} sẽ được khóa sau khi xác nhận qua email. Đây không phải xác minh quyền sở hữu số điện thoại.`,
          html: `<p>Mã xác nhận Word2LaTeX của bạn là <strong>${otp}</strong>.</p><p>Mã hết hạn sau 10 phút. Số liên hệ ${phoneNumber} sẽ được khóa sau khi xác nhận qua email. Đây không phải xác minh quyền sở hữu số điện thoại.</p>`,
        });
        await store.markDelivered(decoded.uid, challengeId);

        return res.status(200).json({ success: true, cooldownSeconds: 60 });
      }

      if (action === 'verify') {
        const code = String(req.body?.code ?? '').trim();
        if (!/^\d{6}$/.test(code)) {
          throw new EndpointError(400, 'INVALID_OTP', 'Mã xác thực phải gồm 6 chữ số.');
        }

        const profile = await store.verify(decoded.uid, email, hashOtp(decoded.uid, code), currentTime);
        await auth.setCustomUserClaims(decoded.uid, {
          ...(firebaseUser.customClaims ?? {}),
          emailOtpVerified: true,
        }).catch(() => console.warn('[Email verification] Profile confirmed; compatibility claim refresh failed.'));
        return res.status(200).json({ success: true, ...profile });
      }

      throw new EndpointError(400, 'INVALID_ACTION', 'Thao tác xác thực không hợp lệ.');
    } catch (error: unknown) {
      if (error instanceof ConfirmationError) {
        return res.status(error.status).json({ error: error.message, code: error.code, ...error.details });
      }
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Email verification] Unhandled error:', msg, error);
      return res.status(503).json({ error: 'Dịch vụ xác nhận email hiện không khả dụng. Vui lòng thử lại sau.' });
    }
  };
}

const handler = createEmailVerificationHandler();

export default function emailVerificationVercelHandler(req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}

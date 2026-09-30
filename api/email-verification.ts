import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { getFirebaseAdmin } from './firebase-admin.js';
import { createOtp, hashOtp, isOtpExpired, normalizeVietnamPhone } from './email-verification-utils.js';

export { hashOtp } from './email-verification-utils.js';

const OTP_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

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

export interface EmailVerificationStore {
  get(uid: string): Promise<RecordData | null>;
  set(uid: string, data: RecordData): Promise<void>;
  update(uid: string, data: RecordData): Promise<void>;
  delete(uid: string): Promise<void>;
  setUser(uid: string, data: RecordData): Promise<void>;
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
  getAdmin?: () => { auth: EmailOtpAuth; db: unknown };
  createStore?: (db: unknown) => EmailVerificationStore;
  createMailer?: () => { sendMail(message: { to: string; subject: string; text: string; html: string }): Promise<unknown> };
  now?: () => Date;
}

class EndpointError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: RecordData) {
    super(message);
  }
}

function createFirestoreStore(db: any): EmailVerificationStore {
  return {
    async get(uid) {
      const snapshot = await db.collection('email_verifications').doc(uid).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    async set(uid, data) {
      await db.collection('email_verifications').doc(uid).set(data);
    },
    async update(uid, data) {
      await db.collection('email_verifications').doc(uid).update(data);
    },
    async delete(uid) {
      await db.collection('email_verifications').doc(uid).delete();
    },
    async setUser(uid, data) {
      await db.collection('users').doc(uid).set(data, { merge: true });
    },
  };
}

function createMailer() {
  let user = process.env.SMTP_USER || process.env.SMTP_GMAIL;
  if (user && !user.includes('@')) {
    console.warn(`[SMTP] Biến môi trường SMTP_GMAIL bị sai định dạng (${user}). Tự động fallback về Giathieu110406@gmail.com`);
    user = 'Giathieu110406@gmail.com';
  }
  const password = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
  const host = process.env.SMTP_HOST || (user ? 'smtp.gmail.com' : '');
  if (!host || !user || !password) {
    const missing = [!host && 'SMTP_HOST', !user && 'SMTP_USER/SMTP_GMAIL', !password && 'SMTP_APP_PASSWORD']
      .filter(Boolean).join(', ');
    throw new EndpointError(503, 'SMTP_UNAVAILABLE', `Dịch vụ gửi email chưa được cấu hình (thiếu: ${missing}).`);
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
    auth: { user, pass: password },
  });
  const from = process.env.SMTP_FROM || user;
  return {
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

function recordNumber(record: RecordData, key: string): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getFirebaseAccountEmail(
  decoded: { email?: string },
  user: { email?: string; providerData?: Array<{ email?: string }> },
): string | null {
  const candidates = [
    decoded.email,
    user.email,
    ...(user.providerData?.map((provider) => provider.email) ?? []),
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
      const decoded = await auth.verifyIdToken(token);
      if (!decoded.uid) {
        throw new EndpointError(401, 'UNAUTHENTICATED', 'Token xác thực không có địa chỉ email hợp lệ.');
      }
      const firebaseUser = await auth.getUser(decoded.uid);
      const email = getFirebaseAccountEmail(decoded, firebaseUser);
      if (!email) {
        throw new EndpointError(401, 'UNAUTHENTICATED', 'Tài khoản không có địa chỉ email hợp lệ.');
      }

      const action = getAction(req);
      const store = (dependencies.createStore ?? createFirestoreStore)(db);
      const mailer = dependencies.createMailer ?? createMailer;
      const currentTime = now();

      if (action === 'send') {
        const phoneNumber = normalizeVietnamPhone(String(req.body?.phoneNumber ?? ''));
        if (!phoneNumber) {
          throw new EndpointError(400, 'INVALID_PHONE', 'Số điện thoại Việt Nam không hợp lệ.');
        }

        const previous = await store.get(decoded.uid);
        const lastSentAt = typeof previous?.lastSentAt === 'string' ? Date.parse(previous.lastSentAt) : Number.NaN;
        const remainingMs = lastSentAt + RESEND_COOLDOWN_MS - currentTime.getTime();
        if (Number.isFinite(lastSentAt) && remainingMs > 0) {
          throw new EndpointError(429, 'RESEND_COOLDOWN', 'Vui lòng chờ trước khi gửi lại mã.', {
            cooldownSeconds: Math.ceil(remainingMs / 1000),
          });
        }

        const otp = createOtp();
        const otpHash = hashOtp(decoded.uid, otp);
        const expiresAt = new Date(currentTime.getTime() + OTP_TTL_MS).toISOString();
        await mailer().sendMail({
          to: email,
          subject: 'Mã xác thực Word2LaTeX',
          text: `Mã xác thực Word2LaTeX của bạn là ${otp}. Mã hết hạn sau 10 phút.`,
          html: `<p>Mã xác thực Word2LaTeX của bạn là <strong>${otp}</strong>.</p><p>Mã hết hạn sau 10 phút.</p>`,
        });
        await store.set(decoded.uid, {
          phoneNumber,
          otpHash,
          attempts: 0,
          lastSentAt: currentTime.toISOString(),
          expiresAt,
        });

        return res.status(200).json({ success: true, cooldownSeconds: 60 });
      }

      if (action === 'verify') {
        const code = String(req.body?.code ?? '').trim();
        if (!/^\d{6}$/.test(code)) {
          throw new EndpointError(400, 'INVALID_OTP', 'Mã xác thực phải gồm 6 chữ số.');
        }

        const record = await store.get(decoded.uid);
        if (!record) {
          throw new EndpointError(400, 'OTP_NOT_REQUESTED', 'Bạn cần yêu cầu một mã xác thực mới.');
        }
        if (isOtpExpired(String(record.expiresAt ?? ''), currentTime)) {
          await store.delete(decoded.uid);
          throw new EndpointError(400, 'OTP_EXPIRED', 'Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.');
        }
        if (recordNumber(record, 'attempts') >= MAX_ATTEMPTS) {
          throw new EndpointError(429, 'OTP_LOCKED', 'Bạn đã nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.');
        }
        if (hashOtp(decoded.uid, code) !== record.otpHash) {
          const attempts = recordNumber(record, 'attempts') + 1;
          await store.update(decoded.uid, { attempts });
          if (attempts >= MAX_ATTEMPTS) {
            throw new EndpointError(429, 'OTP_LOCKED', 'Bạn đã nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.');
          }
          throw new EndpointError(400, 'INVALID_OTP', 'Mã xác thực không đúng.');
        }

        const verifiedAt = currentTime.toISOString();
        await store.setUser(decoded.uid, {
          phoneNumber: record.phoneNumber,
          emailOtpVerifiedAt: verifiedAt,
        });
        await auth.setCustomUserClaims(decoded.uid, {
          ...(firebaseUser.customClaims ?? {}),
          emailOtpVerified: true,
        });
        await store.delete(decoded.uid);
        return res.status(200).json({ success: true, emailOtpVerifiedAt: verifiedAt });
      }

      throw new EndpointError(400, 'INVALID_ACTION', 'Thao tác xác thực không hợp lệ.');
    } catch (error: unknown) {
      if (error instanceof EndpointError) {
        return res.status(error.status).json({ error: error.message, code: error.code, ...error.details });
      }
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Email verification] Unhandled error:', msg, error);
      return res.status(503).json({ error: `Dịch vụ xác thực email hiện không khả dụng. (${msg})` });
    }
  };
}

const handler = createEmailVerificationHandler();

export default function emailVerificationVercelHandler(req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}

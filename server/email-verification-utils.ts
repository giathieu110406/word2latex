import { createHmac, randomInt } from 'node:crypto';

const VIETNAM_MOBILE_PHONE = /^0[35789]\d{8}$/;

export function normalizeVietnamPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const local = compact.startsWith('+84')
    ? `0${compact.slice(3)}`
    : compact;

  if (!VIETNAM_MOBILE_PHONE.test(local)) {
    return null;
  }

  return `+84${local.slice(1)}`;
}

export function createOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(uid: string, otp: string): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) {
    throw new Error('OTP_PEPPER env var is not configured on server');
  }

  return createHmac('sha256', pepper).update(`${uid}:${otp}`).digest('hex');
}

export function isOtpExpired(expiresAt: string, now = new Date()): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime();
}

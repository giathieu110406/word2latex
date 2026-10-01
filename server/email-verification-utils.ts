import { createHmac, randomInt } from 'node:crypto';

export { normalizeVietnamPhone } from '../shared/phone-confirmation.js';

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

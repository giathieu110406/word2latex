// Structural checks only; number portability and email OTP cannot prove ownership.
// Prefix references: docs/superpowers/specs/phone-prefix-sources.md
const MOBILE_PREFIX = /^0(?:3[2-9]|5[25689]|7[06789]|8[1-9]|9[0-46-9])\d{7}$/;

export function normalizeVietnamPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const local = compact.startsWith('+84') ? `0${compact.slice(3)}` : compact;
  if (!MOBILE_PREFIX.test(local)) return null;
  const subscriber = local.slice(3);
  if (/^(\d)\1{6}$/.test(subscriber)
    || '0123456789'.includes(subscriber)
    || '9876543210'.includes(subscriber)) return null;
  return `+84${local.slice(1)}`;
}

export function isValidVerificationDate(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0 && Number.isFinite(Date.parse(value));
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date instanceof Date && Number.isFinite(date.getTime());
  }
  return false;
}

export function hasPhoneConfirmation(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;
  const data = profile as Record<string, unknown>;
  const current = normalizeVietnamPhone(String(data.phoneNumber ?? ''));
  return !!current && current === data.confirmedPhoneNumber
    && data.phoneConfirmationVersion === 1 && data.phoneConfirmationMethod === 'email_otp'
    && isValidVerificationDate(data.emailOtpVerifiedAt) && isValidVerificationDate(data.phoneConfirmedAt);
}

export interface ConfirmedPhoneProfile {
  phoneNumber: string;
  confirmedPhoneNumber: string;
  emailOtpVerifiedAt: string;
  phoneConfirmedAt: string;
  phoneConfirmationMethod: 'email_otp';
  phoneConfirmationVersion: 1;
}

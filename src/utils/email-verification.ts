import { isValidVerificationDate } from '../../shared/phone-confirmation';
export { hasPhoneConfirmation } from '../../shared/phone-confirmation';

export function isEmailOtpVerified(userDoc: unknown): boolean {
  if (!userDoc || typeof userDoc !== 'object') return false;
  const verifiedAt = (userDoc as { emailOtpVerifiedAt?: unknown }).emailOtpVerifiedAt;

  return isValidVerificationDate(verifiedAt);
}

export function isEmailOtpVerified(userDoc: unknown): boolean {
  if (!userDoc || typeof userDoc !== 'object') return false;
  const verifiedAt = (userDoc as { emailOtpVerifiedAt?: unknown }).emailOtpVerifiedAt;

  if (verifiedAt instanceof Date) {
    return Number.isFinite(verifiedAt.getTime());
  }
  if (typeof verifiedAt === 'string') {
    return verifiedAt.trim().length > 0 && Number.isFinite(Date.parse(verifiedAt));
  }
  if (verifiedAt && typeof verifiedAt === 'object' && 'toDate' in verifiedAt) {
    const timestamp = verifiedAt as { toDate?: () => Date };
    const date = timestamp.toDate?.();
    return date instanceof Date && Number.isFinite(date.getTime());
  }

  return false;
}

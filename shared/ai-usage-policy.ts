import { getActivePlan } from './subscription-policy.js';

// A usage day starts at 05:00 in Vietnam on both the client and server.
export function getAiUsageDay(now = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(now.getTime() - 5 * 60 * 60 * 1000));
}

export function getPromptLimit(profile: any, now = Date.now()) {
  const plan = getActivePlan(profile.planType, profile.planExpiresAt, now);
  return 15 * (plan === 'pro' ? 4 : plan === 'plus' || plan === 'trial' ? 2 : 1);
}

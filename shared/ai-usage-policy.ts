import { getActivePlan, getPlanLimits } from './subscription-policy.js';

// A usage day starts at 00:00 (midnight) in Vietnam on both the client and server.
export function getAiUsageDay(now = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

export function getPromptLimit(profile: any, now = Date.now()) {
  const plan = getActivePlan(profile.planType, profile.planExpiresAt, now);
  return getPlanLimits(plan).ai;
}

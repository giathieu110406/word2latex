const PLAN_RANK: Record<string, number> = { free: 0, trial: 1, plus: 2, pro: 3 };

export function getActivePlan(plan = 'free', expiresAt?: number, now = Date.now()) {
  return expiresAt && now >= expiresAt ? 'free' : plan;
}

export function canRegisterPlan(target: string, current = 'free', expiresAt?: number, now = Date.now(), hasUsedTrial?: boolean) {
  // Cho phép đăng ký lại gói Trial không giới hạn số lần
  return (PLAN_RANK[target] ?? 0) > (PLAN_RANK[getActivePlan(current, expiresAt, now)] ?? 0);
}

export function getUpgradeVisibility(plan = 'free', expiresAt?: number, now = Date.now()) {
  const activePlan = getActivePlan(plan, expiresAt, now);
  return { sidebar: !['trial', 'plus', 'pro'].includes(activePlan), main: activePlan !== 'pro' };
}

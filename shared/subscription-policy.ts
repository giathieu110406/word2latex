const PLAN_RANK: Record<string, number> = { free: 0, trial: 1, plus: 2, pro: 3 };

export function getActivePlan(plan = 'free', expiresAt?: number, now = Date.now()) {
  return expiresAt && now >= expiresAt ? 'free' : plan;
}

export function canRegisterPlan(target: string, current = 'free', expiresAt?: number, now = Date.now()) {
  return (PLAN_RANK[target] ?? 0) > (PLAN_RANK[getActivePlan(current, expiresAt, now)] ?? 0);
}

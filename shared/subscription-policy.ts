const PLAN_RANK: Record<string, number> = { free: 0, trial: 1, plus: 2, pro: 3 };

export const PLAN_LIMITS = {
  free: {
    latex: 30,
    exam: 10,
    ai: 12,
    markitdown: 10, // Chế độ AnyDoc không AI: 10 file/ngày
  },
  trial: {
    latex: 60,
    exam: 20,
    ai: 24,
    markitdown: 30, // Chế độ AnyDoc không AI: 30 file/ngày
  },
  plus: {
    latex: Infinity,
    exam: 30,
    ai: 30,
    markitdown: 50, // Chế độ AnyDoc không AI: 50 file/ngày
  },
  pro: {
    latex: Infinity,
    exam: Infinity,
    ai: 45,
    markitdown: Infinity, // Không giới hạn
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan = 'free', role?: string) {
  if (role === 'admin') {
    return { latex: Infinity, exam: Infinity, ai: Infinity, markitdown: Infinity };
  }
  return PLAN_LIMITS[(plan as PlanType)] || PLAN_LIMITS.free;
}

export function getActivePlan(plan = 'free', expiresAt?: number, now = Date.now()) {
  return expiresAt && now >= expiresAt ? 'free' : plan;
}

export function canRegisterPlan(target: string, current = 'free', expiresAt?: number, now = Date.now(), hasUsedTrial?: boolean) {
  // Cho phép đăng ký lại gói Trial không giới hạn số lần
  if (target === 'trial') return false; // Gói TRIAL đã ngừng hỗ trợ đăng ký mới
  return (PLAN_RANK[target] ?? 0) > (PLAN_RANK[getActivePlan(current, expiresAt, now)] ?? 0);
}

export function getUpgradeVisibility(plan = 'free', expiresAt?: number, now = Date.now()) {
  const activePlan = getActivePlan(plan, expiresAt, now);
  return { sidebar: !['trial', 'plus', 'pro'].includes(activePlan), main: activePlan !== 'pro' };
}

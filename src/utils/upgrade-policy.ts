import { getActivePlan } from '../../shared/subscription-policy';

export function getUpgradeVisibility(plan = 'free', expiresAt?: number, now = Date.now()) {
  const activePlan = getActivePlan(plan, expiresAt, now);
  return { sidebar: !['trial', 'plus', 'pro'].includes(activePlan), main: activePlan !== 'pro' };
}

export function getUpgradeVisibility(plan = 'free', expiresAt?: number, now = Date.now()) {
  const activePlan = expiresAt && now >= expiresAt ? 'free' : plan;
  return { sidebar: !['trial', 'plus', 'pro'].includes(activePlan), main: activePlan !== 'pro' };
}

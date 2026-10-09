import { getAiUsageDay, getPromptLimit } from '../shared/ai-usage-policy.js';

export class PromptQuotaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Reserve directly in the existing account bucket so simultaneous drawing calls cannot overspend it.
export async function reservePromptUsage(db: any, user: { uid: string; isOwner: boolean }) {
  const ref = db.collection('users').doc(user.uid);
  const day = getAiUsageDay();
  await db.runTransaction(async (tx: any) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new PromptQuotaError(403, 'Không tìm thấy tài khoản để kiểm tra lượt tinh chỉnh AI.');
    const profile = snapshot.data();
    const reset = profile.lastLatexResetDate !== day;
    const count = reset ? 0 : Number(profile.promptCount || 0);
    if (!user.isOwner && profile.status !== 'approved' && count >= getPromptLimit(profile)) {
      throw new PromptQuotaError(429, 'Bạn đã hết lượt tinh chỉnh AI của tài khoản hôm nay. Vẽ thủ công vẫn không giới hạn.');
    }
    tx.update(ref, {
      ...(reset ? { latexCount: 0, examCount: 0, markItDownCount: 0 } : {}),
      lastLatexResetDate: day,
      promptCount: count + 1,
      queryCount: Number(profile.queryCount || 0) + 1,
    });
  });
  return async () => {
    await db.runTransaction(async (tx: any) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return;
      const profile = snapshot.data();
      tx.update(ref, {
        ...(profile.lastLatexResetDate === day ? { promptCount: Math.max(0, Number(profile.promptCount || 0) - 1) } : {}),
        queryCount: Math.max(0, Number(profile.queryCount || 0) - 1),
      });
    });
  };
}

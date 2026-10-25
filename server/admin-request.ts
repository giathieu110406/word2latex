import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseAdmin } from './firebase-admin.js';

const userProfileCache = new Map<string, { profile: any; expires: number }>();

export async function requireUser(req: VercelRequest, res: VercelResponse) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return null;
  }

  const { auth, db } = getFirebaseAdmin();
  const decodedToken = await auth.verifyIdToken(header.slice(7)).catch(() => null);
  if (!decodedToken) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }

  const now = Date.now();
  const cached = userProfileCache.get(decodedToken.uid);
  if (cached && cached.expires > now) {
    return { decodedToken, db, profile: cached.profile };
  }

  const userDoc = await db.collection('users').doc(decodedToken.uid).get().catch(() => null);
  const profile = userDoc?.data() || {};
  userProfileCache.set(decodedToken.uid, { profile, expires: now + 5 * 60 * 1000 });

  return { decodedToken, db, profile };
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const context = await requireUser(req, res);
  if (!context) return null;
  const { decodedToken, db, profile } = context;
  const isOwner = decodedToken.email?.toLowerCase() === 'giathieu110406@gmail.com';

  if (isOwner) {
    return { decodedToken, db, profile: { ...profile, role: 'admin' } };
  }

  const adminDoc = profile.role !== 'admin' ? await db.collection('admins').doc(decodedToken.uid).get().catch(() => null) : null;
  if (profile.role !== 'admin' && !adminDoc?.exists) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return { decodedToken, db, profile };
}

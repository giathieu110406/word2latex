import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseAdmin } from './firebase-admin.js';

export async function requireAdmin(req: VercelRequest, res: VercelResponse) {
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

  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const isOwner = decodedToken.email?.toLowerCase() === 'giathieu110406@gmail.com';
  if (!isOwner && userDoc.data()?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return { decodedToken, db };
}

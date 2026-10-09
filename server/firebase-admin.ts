import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function getFirebaseAdmin() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
      databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
    });
  }

  const rawDatabaseId = (process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || '').trim();
  const databaseId = rawDatabaseId.includes('/databases/') ? rawDatabaseId.split('/databases/')[1].split('/')[0] : rawDatabaseId;
  const namedDatabase = databaseId && !['default','(default)'].includes(databaseId) && !/[/:]/.test(databaseId);
  return {
    auth: getAuth(),
    db: namedDatabase ? getFirestore(databaseId) : getFirestore(),
  };
}

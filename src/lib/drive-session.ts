const key = (accountId: string) => `word2latex.drive.${accountId}`;

export function readDriveSession(accountId: string): string | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(key(accountId)) || 'null');
    if (typeof session?.token === 'string' && session.expiresAt > Date.now() + 60000) return session.token;
    sessionStorage.removeItem(key(accountId));
  } catch { /* Storage may be unavailable in private browsing. */ }
  return null;
}

export function saveDriveSession(accountId: string, token: string, expiresIn: number) {
  try { sessionStorage.setItem(key(accountId), JSON.stringify({ token, expiresAt: Date.now() + expiresIn * 1000 })); } catch { /* Current in-memory session still works. */ }
}

export function clearDriveSession(accountId: string) {
  try { sessionStorage.removeItem(key(accountId)); } catch { /* Storage unavailable. */ }
}

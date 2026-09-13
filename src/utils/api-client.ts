import { auth } from "../firebase";

/**
 * Lấy header kèm theo Firebase ID Token của người dùng hiện tại để gửi tới Backend
 */
export async function getAuthHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...customHeaders };
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn("[API Client] Không thể lấy Firebase ID token:", e);
    }
  }
  return headers;
}

/**
 * Wrapper cho fetch tự động gắn Authorization Bearer Token
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders((options.headers as Record<string, string>) || {});
  return fetch(url, {
    ...options,
    headers
  });
}

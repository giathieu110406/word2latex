import { auth } from "../firebase";

/**
 * Lấy header kèm theo Firebase ID Token của người dùng hiện tại để gửi tới Backend
 */
export async function getAuthHeaders(customHeaders: Record<string, string> = {}, forceRefresh = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...customHeaders };
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken(forceRefresh);
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
 * Tự động làm mới token và thử lại 1 lần nếu nhận HTTP 401
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders((options.headers as Record<string, string>) || {});
  let response = await fetch(url, {
    ...options,
    headers
  });

  // Nếu gặp 401 và user còn đang đăng nhập, tự động làm mới token và thử lại 1 lần
  if (response.status === 401 && auth.currentUser) {
    try {
      console.log("[API Client] Nhận 401 Unauthorized, đang tự động làm mới Firebase ID Token...");
      const refreshedHeaders = await getAuthHeaders((options.headers as Record<string, string>) || {}, true);
      response = await fetch(url, {
        ...options,
        headers: refreshedHeaders
      });
    } catch (refreshErr) {
      console.warn("[API Client] Lỗi khi làm mới token và thử lại:", refreshErr);
    }
  }

  return response;
}

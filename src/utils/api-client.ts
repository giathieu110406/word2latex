import { auth } from "../firebase";
import { beginCodexPetActivity, type CodexPetResult } from "./codex-pet-activity";

function getAiActivityLabel(url: string): string | null {
  if (/\/api\/ve-hinh\?action=reconstruct(?:&|$)/i.test(url)) return "Đang dựng bản đề xuất hình học…";
  if (/\/api\/markitdown(?:[?#]|$)/i.test(url)) return "Đang chuyển đổi tài liệu bằng AI…";
  if (!/\/api\/ai(?:[?#]|$)/i.test(url)) return null;

  const action = /[?&]action=([^&#]+)/i.exec(url)?.[1];
  if (action === "log-usage" || action === "get-usage-stats") return null;
  switch (action) {
    case "extract-text": return "Đang đọc nội dung tài liệu…";
    case "smart-paste-parse": return "Đang phân tích câu hỏi…";
    case "shuffle-ai": return "Đang biến đổi đề thi bằng AI…";
    case "gemini-canvas": return "Đang xử lý nội dung trên Canvas…";
    default: return "Đang xử lý yêu cầu AI…";
  }
}

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
  const label = getAiActivityLabel(url);
  let finishPetActivity: ((result?: CodexPetResult) => void) | undefined = label
    ? beginCodexPetActivity(label)
    : undefined;

  try {
    const requestHeaders = { ...((options.headers as Record<string, string>) || {}) };
    if (options.method?.toUpperCase() === 'POST') requestHeaders['X-Activity-Id'] ||= crypto.randomUUID();
    const headers = await getAuthHeaders(requestHeaders);
    let response = await fetch(url, {
      ...options,
      headers
    });

    // Nếu gặp 401 và user còn đang đăng nhập, tự động làm mới token và thử lại 1 lần
    if (response.status === 401 && auth.currentUser) {
      try {
        console.log("[API Client] Nhận 401 Unauthorized, đang tự động làm mới Firebase ID Token...");
        const refreshedHeaders = await getAuthHeaders(requestHeaders, true);
        response = await fetch(url, {
          ...options,
          headers: refreshedHeaders
        });
      } catch (refreshErr) {
        console.warn("[API Client] Lỗi khi làm mới token và thử lại:", refreshErr);
      }
    }

    const result: CodexPetResult = response.status === 401 || response.status === 403
      ? "needs-input"
      : response.ok ? "ready" : "blocked";
    finishPetActivity?.(result);
    finishPetActivity = undefined;
    return response;
  } catch (error) {
    finishPetActivity?.("blocked");
    finishPetActivity = undefined;
    throw error;
  } finally {
    finishPetActivity?.("blocked");
  }
}

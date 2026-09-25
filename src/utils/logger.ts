import { authFetch } from "./api-client";
import { db, auth } from "../firebase";
import { doc, setDoc, increment } from "firebase/firestore";

function getVietnamTimeInfo() {
  const now = new Date();
  const formatterHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    hour12: false
  });
  const parts = formatterHour.formatToParts(now);
  const hourPart = parts.find(p => p.type === 'hour');
  let vnHour = hourPart ? hourPart.value.padStart(2, '0') : '00';
  if (vnHour === '24') vnHour = '00';

  const formatterDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const vnDate = formatterDate.format(now);
  return { vnHour, vnDate, nowIso: now.toISOString() };
}

export function normalizeFeatureName(rawName: string): string {
  const trimmed = (rawName || "").trim();
  const lower = trimmed.toLowerCase();
  if (lower === "ai canvas" || lower === "aicanvas") return "AI Canvas";
  if (lower === "markitdown" || lower === "markitdown ai") return "MarkItDown AI";
  if (lower === "chuyển đổi latex" || lower === "chuyen doi latex") return "Chuyển đổi LaTeX";
  if (lower === "soạn đề thi (ai)" || lower === "soan de thi (ai)" || lower === "soạn đề thi") return "Soạn đề thi (AI)";
  if (lower === "dán ai" || lower === "dan ai") return "Dán AI";
  if (lower === "ai hỏi đáp" || lower === "ai hoi dap") return "AI hỏi đáp";
  if (lower === "ai thay thế số liệu") return "AI thay thế số liệu";
  if (lower === "trích xuất văn bản") return "Trích xuất văn bản";
  return trimmed;
}

export const logApiUsage = (featureRaw: string, durationMinutes = 1) => {
  const feature = normalizeFeatureName(featureRaw);
  const duration = Math.max(1, Math.round(durationMinutes));

  // 1. Ghi nhận trực tiếp vào Cloud Firestore từ Client nếu người dùng đã đăng nhập
  if (db && auth?.currentUser) {
    try {
      const { vnHour, vnDate, nowIso } = getVietnamTimeInfo();
      const docRef = doc(db, 'api_usage_stats', vnDate);
      setDoc(docRef, {
        timestamp: nowIso,
        date: vnDate,
        requests: increment(1),
        totalDurationMinutes: increment(duration),
        [feature]: increment(1),
        hourly: {
          [vnHour]: {
            requests: increment(1),
            durationMinutes: increment(duration)
          }
        },
        featureDurations: {
          [feature]: increment(duration)
        }
      }, { merge: true }).catch(err => {
        // Fallback qua API nếu có vấn đề phân quyền
        console.warn(`[Logger] Firestore client log warning for ${feature}:`, err);
      });
    } catch (e) {
      console.warn("[Logger] Direct Firestore logging error:", e);
    }
  }

  // 2. Gửi đồng thời tới API backend
  try {
    authFetch("/api/ai?action=log-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature,
        durationMinutes: duration
      })
    }).catch(err => console.warn(`Failed to log API usage for ${feature}`, err));
  } catch (e) {
    console.warn("Failed to log API usage", e);
  }
};

let activeFeature: string | null = null;
let activeStartTime: number = Date.now();

export const startFeatureTracking = (feature: string) => {
  if (activeFeature && activeFeature !== feature) {
    flushFeatureTracking();
  }
  activeFeature = feature;
  activeStartTime = Date.now();
};

export const flushFeatureTracking = () => {
  if (!activeFeature) return;
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - activeStartTime) / 60000));
  // Chỉ log thời lượng nếu người dùng ở trên trang ít nhất 10 giây
  if (Date.now() - activeStartTime >= 10000) {
    logApiUsage(activeFeature, elapsedMinutes);
  }
  activeStartTime = Date.now();
};


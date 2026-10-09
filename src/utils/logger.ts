import { authFetch } from './api-client';
import { auth } from '../firebase';
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

// Client reports are observations. Sensitive AI success/error is recorded by the server handler.
export const logApiUsage = (featureRaw: string, _durationMinutes = 0) => {
  if (!auth.currentUser) return;
  const action = normalizeFeatureName(featureRaw);
  void authFetch('/api/activity', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,eventId:crypto.randomUUID()}), keepalive:true,
  }).then(response=>{if(!response.ok) console.warn('[Activity] Observation was not recorded',response.status);})
    .catch(()=>console.warn('[Activity] Observation was not recorded'));
};
let activeFeature: string | null = null;
export const startFeatureTracking = (feature: string) => {
  if (activeFeature === feature) return;
  activeFeature = feature;
  logApiUsage('Xem tính năng: '+feature);
};
export const flushFeatureTracking = () => { activeFeature = null; };

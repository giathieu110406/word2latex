import { authFetch } from "./api-client";

export const logApiUsage = (feature: string, durationMinutes = 1) => {
  try {
    authFetch("/api/ai?action=log-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature,
        durationMinutes: Math.max(1, Math.round(durationMinutes))
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


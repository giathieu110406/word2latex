export const logApiUsage = (feature: string) => {
    try {
      fetch("/api/ai?action=log-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature })
      }).catch(err => console.warn(`Failed to log API usage for ${feature}`, err));
    } catch (e) {
      console.warn("Failed to log API usage", e);
    }
};

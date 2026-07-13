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

export const logRawInteraction = (service: 'latex' | 'qbuilder', input: string, output: string, userId?: string) => {
    try {
      fetch("/api/ai?action=log-raw-interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, service, input, output })
      }).catch(err => console.warn(`Failed to log raw interaction for ${service}`, err));
    } catch (e) {
      console.warn("Failed to log raw interaction", e);
    }
};

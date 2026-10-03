export type CodexPetActivityStatus = "idle" | "running" | "needs-input" | "ready" | "blocked";
export type CodexPetResult = Exclude<CodexPetActivityStatus, "idle" | "running">;

export interface CodexPetActivity {
  status: CodexPetActivityStatus;
  message: string;
}

const IDLE_ACTIVITY: CodexPetActivity = { status: "idle", message: "" };
let activity: CodexPetActivity = IDLE_ACTIVITY;
let nextActivityId = 0;
const activeActivities = new Map<number, string>();
const listeners = new Set<() => void>();
let resetTimer: ReturnType<typeof setTimeout> | undefined;

function publish(next: CodexPetActivity) {
  activity = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToCodexPetActivity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCodexPetActivity() {
  return activity;
}

export function beginCodexPetActivity(label: string) {
  if (resetTimer) clearTimeout(resetTimer);

  const id = nextActivityId++;
  activeActivities.set(id, label);
  publish({ status: "running", message: activeActivities.get(id)! });

  let finished = false;
  return (result: CodexPetResult = "ready") => {
    if (finished) return;
    finished = true;
    activeActivities.delete(id);

    const remainingLabels = Array.from(activeActivities.values());
    const remainingLabel = remainingLabels[remainingLabels.length - 1];
    if (remainingLabel) {
      publish({ status: "running", message: remainingLabel });
      return;
    }

    const message = result === "ready"
      ? "Xong rồi! Bạn xem kết quả nhé."
      : result === "needs-input"
        ? "Mình cần bạn kiểm tra đăng nhập hoặc quyền truy cập nhé."
        : "Mình gặp sự cố khi xử lý. Bạn thử lại nhé.";
    publish({ status: result, message });
    resetTimer = setTimeout(() => {
      resetTimer = undefined;
      if (activeActivities.size === 0) publish(IDLE_ACTIVITY);
    }, 3500);
  };
}

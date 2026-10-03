import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { getCodexPetActivity, subscribeToCodexPetActivity } from "../utils/codex-pet-activity";

interface PetFrame {
  rowIndex: number;
  columnIndex: number;
  frameDurationMs: number;
}

const createFrames = (rowIndex: number, count: number, frameDurationMs: number, lastFrameDurationMs: number): PetFrame[] =>
  Array.from({ length: count }, (_, columnIndex) => ({
    rowIndex,
    columnIndex,
    frameDurationMs: columnIndex === count - 1 ? lastFrameDurationMs : frameDurationMs,
  }));

const eyeFrames = createFrames(0, 6, 140, 320);
const idleEyeFrames = eyeFrames.slice(0, 3).map((frame) => ({ ...frame, frameDurationMs: 2000 }));
const jumpingFrames = createFrames(4, 5, 280, 560);
const runningFrames = createFrames(7, 6, 1000, 1000);

const activityFrames: Record<string, PetFrame[]> = {
  idle: jumpingFrames,
  running: runningFrames,
  "needs-input": createFrames(6, 6, 300, 600),
  ready: createFrames(3, 4, 300, 600),
  blocked: createFrames(5, 8, 280, 560),
};

const PET_PREVIEW_STATES = [
  { status: "idle", label: "Nghỉ" },
  { status: "running", label: "Đang làm việc" },
  { status: "needs-input", label: "Cần kiểm tra" },
  { status: "ready", label: "Hoàn tất" },
  { status: "blocked", label: "Gặp sự cố" },
];

function CodexPetSprite({ status, hovered, reduceMotion }: { status: string; hovered: boolean; reduceMotion: boolean }) {
  const [frame, setFrame] = useState<PetFrame>(eyeFrames[0]);

  useEffect(() => {
    const isIdleAndUnhovered = status === "idle" && !hovered;
    const frames = status !== "idle" ? activityFrames[status] ?? jumpingFrames : jumpingFrames;
    if (reduceMotion) {
      setFrame(isIdleAndUnhovered ? eyeFrames[0] : frames[0]);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    if (isIdleAndUnhovered) {
      let eyeTransition = 0;

      const animateJump = (index = 0, repetitions = 0) => {
        if (index >= jumpingFrames.length) {
          if (repetitions + 1 < 2) {
            animateJump(0, repetitions + 1);
            return;
          }
          eyeTransition = 0;
          advanceEyes();
          return;
        }
        const currentFrame = jumpingFrames[index];
        setFrame(currentFrame);
        timer = setTimeout(() => animateJump(index + 1, repetitions), currentFrame.frameDurationMs);
      };

      const advanceEyes = () => {
        if (eyeTransition >= idleEyeFrames.length) {
          animateJump();
          return;
        }
        const currentFrame = idleEyeFrames[eyeTransition];
        setFrame(currentFrame);
        timer = setTimeout(() => {
          eyeTransition += 1;
          advanceEyes();
        }, currentFrame.frameDurationMs);
      };

      advanceEyes();
      return () => clearTimeout(timer);
    }

    let frameIndex = 0;
    const advance = () => {
      const currentFrame = frames[frameIndex];
      setFrame(currentFrame);
      timer = setTimeout(() => {
        frameIndex += 1;
        if (frameIndex >= frames.length) {
          frameIndex = 0;
        }
        advance();
      }, currentFrame.frameDurationMs);
    };

    advance();
    return () => clearTimeout(timer);
  }, [status, hovered, reduceMotion]);

  return (
    <div
      aria-hidden="true"
      className="h-full w-full"
      style={{
        aspectRatio: "192 / 208",
        backgroundImage: "url('/codex-pet-spritesheet.webp')",
        backgroundPosition: `${(frame.columnIndex / 7) * 100}% ${(frame.rowIndex / 10) * 100}%`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "800% 1100%",
        imageRendering: "pixelated",
      }}
    />
  );
}

export const ZALO_BANNER_MESSAGES = [
  "Chào bạn! Mình có thể giúp gì hôm nay?",
  "NẾU BẠN KHÔNG ĐĂNG NHẬP ĐƯỢC LÀ DO WEB LỖI. LIÊN HỆ NGAY ĐỂ ĐĂNG NHẬP",
  "Cần hỗ trợ gấp? Chat Zalo ngay!",
  "Tư vấn nâng cấp tài khoản Pro qua Zalo",
  "Gặp sự cố chuyển đổi? Nhắn Admin nhé!",
];

export const ZALO_PHONE = "0335.784.563";
export const ZALO_LINK = "https://zalo.me/0335784563";

const STATUS_COLOR: Record<string, string> = {
  idle: "bg-blue-600",
  running: "bg-violet-600",
  "needs-input": "bg-amber-500",
  ready: "bg-emerald-500",
  blocked: "bg-rose-500",
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Sẵn sàng",
  running: "Đang làm việc",
  "needs-input": "Cần bạn kiểm tra",
  ready: "Đã hoàn tất",
  blocked: "Gặp sự cố",
};

export const ZaloContactWidget: React.FC = () => {
  const activity = useSyncExternalStore(
    subscribeToCodexPetActivity,
    getCodexPetActivity,
    getCodexPetActivity,
  );
  const reduceMotion = useReducedMotion();
  const dragStart = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; width: number; height: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [bannerIndex, setBannerIndex] = useState<number>(0);
  const [isBubbleVisible, setIsBubbleVisible] = useState<boolean>(true);
  const [isPetHovered, setIsPetHovered] = useState<boolean>(false);
  const [isPetDragging, setIsPetDragging] = useState<boolean>(false);
  const [dragPosition, setDragPosition] = useState<{ left: number; top: number } | null>(null);
  const [showPetDevTools, setShowPetDevTools] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const toggleDevTools = (event: KeyboardEvent) => {
      if (event.code !== "Backquote" && event.key !== "`") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))) return;
      event.preventDefault();
      setShowPetDevTools((visible) => !visible);
    };
    window.addEventListener("keydown", toggleDevTools);
    return () => window.removeEventListener("keydown", toggleDevTools);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = dragStart.current;
      if (!start || event.pointerId !== start.pointerId) return;
      const deltaX = event.clientX - start.startX;
      const deltaY = event.clientY - start.startY;
      if (!start.moved && Math.hypot(deltaX, deltaY) < 4) return;
      start.moved = true;
      setIsPetDragging(true);
      setDragPosition({
        left: Math.max(0, Math.min(window.innerWidth - start.width, start.left + deltaX)),
        top: Math.max(0, Math.min(window.innerHeight - start.height, start.top + deltaY)),
      });
    };
    const stop = (event: PointerEvent) => {
      const start = dragStart.current;
      if (!start || event.pointerId !== start.pointerId) return;
      dragStart.current = null;
      setIsPetDragging(false);
      if (start.moved) {
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  useEffect(() => {
    if (activity.status !== "idle") return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % ZALO_BANNER_MESSAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activity.status]);

  const displayedActivity = previewStatus
    ? {
      status: previewStatus,
      message: `${STATUS_LABEL[previewStatus]} · Xem thử`,
    }
    : activity;
  const bubbleMessage = displayedActivity.status === "idle"
    ? ZALO_BANNER_MESSAGES[bannerIndex]
    : displayedActivity.message;
  return (
    <>
      {showPetDevTools && import.meta.env.DEV && (
        <section aria-label="Codex pet dev tools" className="fixed left-4 top-20 z-[60] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:left-6 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-slate-800">Thử trạng thái Codex</h2>
            <span className="text-xs text-slate-500">Nhấn ` để đóng</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PET_PREVIEW_STATES.map(({ status, label }) => (
              <button
                key={status}
                type="button"
                aria-pressed={previewStatus === status}
                onClick={() => setPreviewStatus(status)}
                className={`flex min-w-20 flex-col items-center rounded-xl border px-2 py-2 transition-colors ${previewStatus === status ? "border-violet-500 bg-violet-50" : "border-transparent bg-slate-50 hover:bg-slate-100"}`}
              >
                <span className="h-20 w-16">
                  <CodexPetSprite status={status} hovered={false} reduceMotion={false} />
                </span>
                <span className="mt-1 text-center text-[11px] font-semibold text-slate-700">{label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPreviewStatus(null)} className="mt-3 text-xs font-semibold text-violet-700 hover:underline">
            Trở về trạng thái thật
          </button>
        </section>
      )}
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
    <AnimatePresence>
      <motion.div
          onPointerDown={(event) => {
            if ((event.pointerType === "mouse" && event.button !== 0) || (event.target as HTMLElement).closest("button")) return;
            const rect = event.currentTarget.getBoundingClientRect();
            dragStart.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, moved: false };
            suppressClick.current = false;
          }}
          onClickCapture={(event) => {
            if (!suppressClick.current) return;
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }}
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: 0.2 }}
          style={{ ...(dragPosition ? { left: dragPosition.left, top: dragPosition.top } : {}), touchAction: "none" }}
          className={`pointer-events-auto absolute flex select-none items-center gap-2.5 sm:gap-3 ${dragPosition ? "" : "bottom-5 right-4 sm:bottom-6 sm:right-6"} ${isPetDragging ? "cursor-grabbing" : "cursor-grab"}`}
        >
          {isBubbleVisible && <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsBubbleVisible(false);
              }}
              title="Ẩn lời nhắn"
              aria-label="Ẩn lời nhắn"
              className="absolute -top-2.5 -right-2 z-50 w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-slate-700/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/90"
            >
              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            <a
            href={ZALO_LINK}
            target="_blank"
            rel="noreferrer"
            aria-live={displayedActivity.status === "idle" ? "off" : "polite"}
            className="group relative flex items-center gap-2.5 bg-white/95 hover:bg-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-lg hover:shadow-xl border border-blue-200/80 hover:border-blue-400 transition-all duration-300 max-w-[280px] cursor-pointer"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${STATUS_COLOR[displayedActivity.status]} ${displayedActivity.status === "running" ? "animate-ping" : ""}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${STATUS_COLOR[displayedActivity.status]}`} />
            </span>

            <div className="overflow-hidden min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.p
                  key={`${displayedActivity.status}-${displayedActivity.status === "idle" ? bannerIndex : displayedActivity.message}`}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -7 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs sm:text-[13px] font-bold text-slate-800 leading-tight truncate"
                >
                  {bubbleMessage}
                </motion.p>
              </AnimatePresence>
              <span className="text-[10px] sm:text-[11px] font-semibold text-blue-600 group-hover:underline flex items-center gap-1 mt-0.5">
                <span>{displayedActivity.status === "idle" ? `Chat Zalo: ${ZALO_PHONE}` : `${STATUS_LABEL[displayedActivity.status]} · Codex`}</span>
                <span className="text-[10px]">↗</span>
              </span>
            </div>

            <div className="hidden sm:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-t border-r border-blue-200/80 transform rotate-45 group-hover:border-blue-400 transition-colors" />
            </a>
          </div>}

          <a
            href={ZALO_LINK}
            target="_blank"
            rel="noreferrer"
            title={`Kéo để di chuyển thú cưng Codex · Nhắn Zalo ${ZALO_PHONE}`}
            aria-label={`Thú cưng Codex, ${STATUS_LABEL[displayedActivity.status]}. Nhấn để nhắn Zalo ${ZALO_PHONE}`}
            onMouseEnter={() => setIsPetHovered(true)}
            onMouseLeave={() => setIsPetHovered(false)}
            onFocus={() => setIsPetHovered(true)}
            onBlur={() => setIsPetHovered(false)}
            className="relative group flex h-[94.5px] w-[86.4px] shrink-0 cursor-grab items-center justify-center transition-transform duration-300 hover:scale-105 active:scale-95"
          >
            <span className="pointer-events-none flex h-full w-full items-center justify-center">
              <span className="block w-full aspect-[12/13]">
                <CodexPetSprite status={displayedActivity.status} hovered={isPetHovered} reduceMotion={Boolean(reduceMotion)} />
              </span>
            </span>
          </a>
      </motion.div>
    </AnimatePresence>
    </div>
    </>
  );
};

export default ZaloContactWidget;

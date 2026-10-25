import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Square,
  MapPin,
  Undo2,
  Trash2,
  Check,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import html2canvas from "html2canvas-pro";

interface ScreenAnnotatorProps {
  isOpen: boolean;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

type ToolType = "rect" | "pin";

interface DrawingAction {
  tool: ToolType;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  pin?: { x: number; y: number; index: number };
}

const PRIMARY_RED = "#ef4444";

export const ScreenAnnotator: React.FC<ScreenAnnotatorProps> = ({
  isOpen,
  onCapture,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>("rect");
  const [actions, setActions] = useState<DrawingAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Resize canvas to full window
  useEffect(() => {
    if (!isOpen) {
      setActions([]);
      setCurrentAction(null);
      setIsCapturing(false);
      return;
    }

    const updateSize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderCanvas();
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isOpen]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allActions = [...actions, ...(currentAction ? [currentAction] : [])];

    let pinCount = 0;
    allActions.forEach((act) => {
      ctx.save();
      ctx.strokeStyle = PRIMARY_RED;
      ctx.fillStyle = PRIMARY_RED;

      if (act.tool === "rect" && act.start && act.end) {
        const x = Math.min(act.start.x, act.end.x);
        const y = Math.min(act.start.y, act.end.y);
        const w = Math.abs(act.end.x - act.start.x);
        const h = Math.abs(act.end.y - act.start.y);

        // Highlight box: semi-transparent red fill + solid border
        ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
        ctx.fillRect(x, y, w, h);

        ctx.lineWidth = 3;
        ctx.strokeStyle = PRIMARY_RED;
        ctx.strokeRect(x, y, w, h);
      } else if (act.tool === "pin" && act.pin) {
        pinCount++;
        const { x, y } = act.pin;

        // Outer glow circle
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fillStyle = PRIMARY_RED;
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 8;
        ctx.fill();

        // White border
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        // Pin index number
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(pinCount), x, y);
      }
      ctx.restore();
    });
  }, [actions, currentAction]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isCapturing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);

    if (activeTool === "rect") {
      setCurrentAction({
        tool: "rect",
        start: { x, y },
        end: { x, y },
      });
    } else if (activeTool === "pin") {
      const pinIndex = actions.filter((a) => a.tool === "pin").length + 1;
      setActions((prev) => [
        ...prev,
        {
          tool: "pin",
          pin: { x, y, index: pinIndex },
        },
      ]);
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAction) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "rect" && currentAction.start) {
      setCurrentAction({
        ...currentAction,
        end: { x, y },
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentAction) {
      setActions((prev) => [...prev, currentAction]);
      setCurrentAction(null);
    }
    setIsDrawing(false);
  };

  const handleUndo = () => {
    setActions((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setActions([]);
    setCurrentAction(null);
  };

  const handleFinish = async () => {
    try {
      setIsCapturing(true);

      // Temporarily hide our annotator overlay completely from screenshot
      const overlayElem = document.getElementById("screen-annotator-overlay");
      if (overlayElem) overlayElem.style.display = "none";

      // Allow DOM repaint
      await new Promise((resolve) => setTimeout(resolve, 80));

      // Target root element or document.body
      const targetElement = document.getElementById("root") || document.body;

      // Capture the live webpage DOM with html2canvas-pro (supports Tailwind v4 and oklch)
      const pageCanvas = await html2canvas(targetElement, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        scale: window.devicePixelRatio > 1 ? 1.5 : 1,
      });

      // Restore overlay display
      if (overlayElem) overlayElem.style.display = "";

      // Composite annotations onto webpage screenshot
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = pageCanvas.width;
      finalCanvas.height = pageCanvas.height;
      const fctx = finalCanvas.getContext("2d");

      if (fctx) {
        // Draw real page background
        fctx.drawImage(pageCanvas, 0, 0);

        // Draw user annotations if any
        const canvas = canvasRef.current;
        if (canvas) {
          fctx.drawImage(
            canvas,
            0,
            0,
            canvas.width,
            canvas.height,
            0,
            0,
            finalCanvas.width,
            finalCanvas.height
          );
        }

        const dataUrl = finalCanvas.toDataURL("image/png");
        onCapture(dataUrl);
      } else {
        onCapture(pageCanvas.toDataURL("image/png"));
      }
    } catch (err) {
      console.error("Screenshot error:", err);
      // Restore overlay if crashed
      const overlayElem = document.getElementById("screen-annotator-overlay");
      if (overlayElem) overlayElem.style.display = "";

      // Fallback: draw with white background so it never renders as a black box
      const canvas = canvasRef.current;
      if (canvas) {
        const fallbackCanvas = document.createElement("canvas");
        fallbackCanvas.width = canvas.width;
        fallbackCanvas.height = canvas.height;
        const fbCtx = fallbackCanvas.getContext("2d");
        if (fbCtx) {
          fbCtx.fillStyle = "#ffffff";
          fbCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          fbCtx.drawImage(canvas, 0, 0);
          onCapture(fallbackCanvas.toDataURL("image/png"));
        } else {
          onCapture(canvas.toDataURL("image/png"));
        }
      }
    } finally {
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="screen-annotator-overlay"
        className="fixed inset-0 z-[9999] select-none cursor-crosshair pointer-events-auto"
      >
        {/* Fullscreen 100% Transparent Canvas over live page */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="absolute inset-0 w-full h-full bg-transparent"
        />

        {/* Top Hint Pill */}
        {!isCapturing && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl border border-slate-200 text-slate-800 px-5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 pointer-events-none"
          >
            <Sparkles className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>Kéo chuột để khoanh vùng hoặc bấm để ghim điểm lỗi trực tiếp</span>
          </motion.div>
        )}

        {/* Bottom Floating Control Dock (Only Khoanh vùng and Ghim điểm) */}
        {!isCapturing && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-[0_15px_40px_rgba(0,0,0,0.12)] rounded-3xl p-2.5 flex items-center gap-2 sm:gap-3 cursor-default"
          >
            {/* Exactly 2 Tools: Khoanh vùng & Ghim điểm */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTool("rect")}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  activeTool === "rect"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-500/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
                title="Kéo chuột để khoanh vùng hình chữ nhật"
              >
                <Square className="w-4 h-4" />
                <span>Khoanh vùng</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("pin")}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  activeTool === "pin"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-500/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
                title="Nhấp chuột vào vị trí bất kỳ để ghim điểm lỗi"
              >
                <MapPin className="w-4 h-4" />
                <span>Ghim điểm</span>
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            {/* Undo & Clear */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={actions.length === 0}
              className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Hoàn tác nét vẽ vừa tạo"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={actions.length === 0}
              className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Xóa tất cả vùng đã khoanh"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-slate-200" />

            {/* Cancel & Finish */}
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              <span>Hủy</span>
            </button>

            <button
              type="button"
              onClick={handleFinish}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-500/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Xong &amp; Đính kèm</span>
            </button>
          </motion.div>
        )}

        {/* Capturing Spinner Indicator */}
        {isCapturing && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3 text-slate-800 text-xs font-bold">
              <Loader2 className="w-5 h-5 text-rose-600 animate-spin" />
              <span>Đang chụp và gắn ảnh màn hình...</span>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};

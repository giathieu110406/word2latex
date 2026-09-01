import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Check, 
  Lightbulb, 
  FileText,
  Layout
} from "lucide-react";

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  tip?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

export interface PageTourConfig {
  pageId: "latex" | "qbuilder" | "markitdown";
  pageTitle: string;
  pageIcon: React.ReactNode;
  steps: TourStep[];
}

export const TOUR_CONFIGS: Record<string, PageTourConfig> = {
  latex: {
    pageId: "latex",
    pageTitle: "Chuyển đổi LaTeX sang Word",
    pageIcon: <Sparkles className="w-4 h-4 text-indigo-500" />,
    steps: [
      {
        targetId: "tour-latex-input-panel",
        title: "1. Khung soạn thảo & Nhập công thức",
        description:
          "Dán đoạn văn bản hoặc mã LaTeX chứa công thức toán dạng $...$ (trong dòng) hoặc $$...$$ (khối hiển thị). Hệ thống sẽ tự động quét và kiểm tra xem có công thức nào bị quên đóng dấu $ hay không.",
        tip: "Bạn có thể dán trực tiếp ảnh chụp đề bài từ clipboard (Ctrl+V) vào đây để AI tự động trích xuất văn bản.",
        position: "right",
      },
      {
        targetId: "tour-latex-font-controls",
        title: "2. Chọn Phông chữ & Định dạng Word",
        description:
          "Tùy chọn phông chữ khi xuất tài liệu Word (Mặc định là 'Times New Roman' chuẩn quốc gia). Tất cả công thức toán học sẽ được giữ nguyên phông tương ứng và chuyển thành chuẩn Word Equation.",
        tip: "Sử dụng các nút B (In đậm) và I (In nghiêng) để định dạng nhanh văn bản đang bôi đen.",
        position: "bottom",
      },
      {
        targetId: "tour-latex-ai-canvas",
        title: "3. Trợ lý AI Canvas & Trích xuất ảnh",
        description:
          "Gọi Trợ lý AI Canvas để dịch thuật, sửa lỗi logic định dạng, bổ sung lời giải chi tiết từng bước, hoặc đính kèm hình ảnh để AI tự động bóc tách thành công thức LaTeX nguyên bản.",
        tip: "Bấm vào các thẻ gợi ý sẵn (như 'Thêm lời giải chi tiết', 'In đậm từ khóa') để xử lý nhanh chỉ với 1 cú click.",
        position: "bottom",
      },
      {
        targetId: "tour-latex-preview-panel",
        title: "4. Xem trước & Tải về Word Equation",
        description:
          "Xem trước công thức hiển thị trực quan tức thời bằng KaTeX. Bấm 'Sao chép' để dán thẳng vào Microsoft Word thành công thức Equation xịn sò, hoặc bấm 'Tải Word' để lưu file hoàn chỉnh về máy.",
        tip: "Bạn cũng có thể chuyển sang tab 'Tải PDF' để lấy mã nguồn LaTeX tiêu chuẩn cho Overleaf hoặc xuất file PDF trực tiếp.",
        position: "left",
      },
    ],
  },
  qbuilder: {
    pageId: "qbuilder",
    pageTitle: "Soạn đề thi thông minh (Q-Builder)",
    pageIcon: <FileText className="w-4 h-4 text-violet-500" />,
    steps: [
      {
        targetId: "tour-qbuilder-config-header",
        title: "1. Cấu hình Tiêu đề & Thông tin đề thi",
        description:
          "Thiết lập thông tin đầu trang đề thi theo chuẩn Bộ Giáo Dục: Khung đôi (Trường thi, Môn thi, Mã đề, Thông tin học sinh) hoặc Khung đơn căn giữa truyền thống.",
        tip: "Bấm vào thanh 'Thu gọn (▲)' để ẩn bớt phần tiêu đề khi bạn muốn tập trung soạn nội dung câu hỏi.",
        position: "bottom",
      },
      {
        targetId: "tour-qbuilder-type-selector",
        title: "2. Phân loại câu hỏi & Dán thông minh (AI)",
        description:
          "Hỗ trợ đầy đủ 4 dạng câu hỏi: Trắc nghiệm 4 lựa chọn (A,B,C,D), Đúng/Sai, Trả lời ngắn và Tự luận. Bấm nút 'Dán thông minh (AI)' để tự động tách câu hỏi và đáp án từ đoạn chat AI.",
        tip: "AI sẽ tự động nhận dạng các đáp án A, B, C, D và tách riêng lời giải/đáp án vào đúng ô dữ liệu tương ứng.",
        position: "bottom",
      },
      {
        targetId: "tour-qbuilder-saved-list",
        title: "3. Danh sách câu hỏi đã lưu & Chỉnh sửa",
        description:
          "Quản lý toàn bộ câu hỏi đã thêm vào đề. Bạn có thể lọc theo từng dạng câu hỏi, đổi số cột hiển thị đáp án (1, 2, 4 cột), di chuyển thứ tự lên/xuống (▲/▼), hoặc bấm 'Sửa' để chỉnh sửa nội dung.",
        tip: "Hệ thống sẽ tự động đánh lại số thứ tự Câu 1, Câu 2... một cách nhất quán khi bạn di chuyển vị trí.",
        position: "top",
      },
      {
        targetId: "tour-qbuilder-export-panel",
        title: "4. Xáo trộn đề & Xuất đề thi Word",
        description:
          "Bấm 'Trộn đề thi' để hoán vị ngẫu nhiên câu hỏi/đáp án hoặc bật tính năng 'Thay số bằng AI' để tự động đổi số liệu bài toán. Sau đó bấm 'Tải Word' để xuất file đề thi kèm bảng đáp án chi tiết.",
        tip: "Tài liệu Word xuất ra được tạo bảng phân bổ đáp án chuyên nghiệp và bảo toàn 100% công thức toán học.",
        position: "left",
      },
    ],
  },
  markitdown: {
    pageId: "markitdown",
    pageTitle: "MarkItDown AI Enterprise",
    pageIcon: <Layout className="w-4 h-4 text-emerald-500" />,
    steps: [
      {
        targetId: "tour-markitdown-dropzone",
        title: "1. Tải tệp lên hoặc Nhập URL",
        description:
          "Hỗ trợ chuyển đổi đa năng: Tệp PDF (1 đến 100+ trang), Word (.docx), PowerPoint (.pptx), Excel (.xlsx), hình ảnh OCR, âm thanh bài giảng hoặc đường link website / video YouTube.",
        tip: "Chuyển sang tab 'URL / Youtube' ở góc trên để bóc tách nội dung từ bất kỳ trang web nào thành Markdown.",
        position: "right",
      },
      {
        targetId: "tour-markitdown-queue-settings",
        title: "2. Cấu hình Hàng đợi & Cắt trang thông minh",
        description:
          "Tự động chia nhỏ tài liệu PDF nhiều trang thành các phân đoạn (5, 10, 15, 20 trang/lần) kèm khoảng nghỉ an toàn để tránh bị nghẽn hạn mức API và đảm bảo độ chính xác tối đa.",
        tip: "Bật tùy chọn 'Ghi chú mốc trang' để tài liệu kết quả có chú thích ranh giới từng trang rõ ràng.",
        position: "right",
      },
      {
        targetId: "tour-markitdown-output-panel",
        title: "3. Theo dõi Hàng đợi & Tải kết quả Markdown",
        description:
          "Theo dõi tiến độ phân tích từng phần theo thời gian thực. Sau khi hoàn tất, bạn có thể xem trước cấu trúc bảng biểu, công thức toán và bấm 'Sao chép' hoặc 'Tải 1 file .md' về máy tính.",
        tip: "Nếu một phân đoạn bị lỗi do mạng, bạn có thể bấm nút 'Thử lại' riêng cho phân đoạn đó mà không cần chạy lại toàn bộ tệp.",
        position: "left",
      },
    ],
  },
};

interface GuideTourProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: "latex" | "qbuilder" | "markitdown";
}

export const GuideTour: React.FC<GuideTourProps> = ({
  isOpen,
  onClose,
  pageId,
}) => {
  const config = TOUR_CONFIGS[pageId] || TOUR_CONFIGS.latex;
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Reset to step 0 whenever opened or page changes
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen, pageId]);

  const currentStep = config.steps[currentStepIndex] || config.steps[0];

  // Update target rect on step change or resize/scroll
  const updateTargetRect = useCallback(() => {
    if (!isOpen || !currentStep) return;
    const el = document.getElementById(currentStep.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Scroll into view gently if outside viewport
      const isInViewport =
        rect.top >= 60 &&
        rect.bottom <= window.innerHeight - 40 &&
        rect.left >= 20 &&
        rect.right <= window.innerWidth - 20;

      if (!isInViewport) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        // Re-read rect after scroll animation completes
        setTimeout(() => {
          const updated = el.getBoundingClientRect();
          setTargetRect(updated);
        }, 300);
      }
    } else {
      // Fallback: centered rect if element not found
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    const handleScroll = () => updateTargetRect();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [updateTargetRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (currentStepIndex < config.steps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIndex, config.steps.length, onClose]);

  if (!isOpen) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === config.steps.length - 1;
  const totalSteps = config.steps.length;

  // Calculate Popover Position relative to targetRect
  const getPopoverStyle = (): React.CSSProperties => {
    const cardWidth = Math.min(380, window.innerWidth - 32);
    const padding = 16;

    if (!targetRect) {
      // Center of screen fallback
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: `${cardWidth}px`,
        zIndex: 99999,
      };
    }

    const { top, bottom, left, right, width, height } = targetRect;
    const prefPos = currentStep.position || "bottom";

    let posTop = bottom + padding;
    let posLeft = left + width / 2 - cardWidth / 2;

    // Adjust for top preferred
    if (prefPos === "top" && top > 320) {
      posTop = top - 280 - padding;
    } else if (prefPos === "right" && right + cardWidth + padding < window.innerWidth) {
      posTop = Math.max(80, Math.min(top, window.innerHeight - 340));
      posLeft = right + padding;
    } else if (prefPos === "left" && left - cardWidth - padding > 0) {
      posTop = Math.max(80, Math.min(top, window.innerHeight - 340));
      posLeft = left - cardWidth - padding;
    } else if (prefPos === "bottom" || posTop + 300 > window.innerHeight) {
      // If bottom overflows, place above or clamp
      if (top > 320) {
        posTop = top - 290 - padding;
      } else {
        posTop = Math.max(80, window.innerHeight - 320);
      }
    }

    // Horizontal boundary clamp
    posLeft = Math.max(16, Math.min(posLeft, window.innerWidth - cardWidth - 16));
    posTop = Math.max(70, Math.min(posTop, window.innerHeight - 320));

    return {
      position: "fixed",
      top: `${posTop}px`,
      left: `${posLeft}px`,
      width: `${cardWidth}px`,
      zIndex: 99999,
    };
  };

  // SVG mask dimensions for smooth spotlight cutout with border radius
  const spotPadding = 8;
  const spotX = targetRect ? Math.max(0, targetRect.left - spotPadding) : 0;
  const spotY = targetRect ? Math.max(0, targetRect.top - spotPadding) : 0;
  const spotW = targetRect ? targetRect.width + spotPadding * 2 : 0;
  const spotH = targetRect ? targetRect.height + spotPadding * 2 : 0;
  const spotRx = 16;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99990] overflow-hidden select-none">
        {/* SVG Backdrop with Spotlight Cutout */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto transition-all duration-300"
          onClick={onClose}
          style={{ width: "100vw", height: "100vh" }}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              {/* White fills everything (opaque mask = dark backdrop visible) */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black cutout creates transparent hole for the spotlight */}
              {targetRect && (
                <rect
                  x={spotX}
                  y={spotY}
                  width={spotW}
                  height={spotH}
                  rx={spotRx}
                  ry={spotRx}
                  fill="black"
                />
              )}
            </mask>
          </defs>

          {/* Dimmed backdrop rect using the mask */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.72)"
            mask="url(#tour-spotlight-mask)"
          />
        </svg>

        {/* Glowing highlight border around active spotlight element */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none fixed rounded-2xl border-2 border-indigo-400/90 shadow-[0_0_25px_rgba(99,102,241,0.5)] z-[99995]"
            style={{
              top: `${spotY}px`,
              left: `${spotX}px`,
              width: `${spotW}px`,
              height: `${spotH}px`,
            }}
          />
        )}

        {/* Popover Step Dialog Card */}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 15, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={getPopoverStyle()}
          className="bg-white/95 backdrop-blur-xl border border-white/80 shadow-[0_20px_50px_rgba(15,23,42,0.3)] rounded-3xl p-5 md:p-6 flex flex-col gap-4 text-slate-850"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-xl bg-indigo-50 border border-indigo-100/60 shrink-0">
                {config.pageIcon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider truncate">
                  {config.pageTitle}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Bước <strong className="text-slate-800 font-extrabold">{currentStepIndex + 1}</strong> / {totalSteps}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer shrink-0"
              title="Đóng hướng dẫn (Phím Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-2.5">
            <h4 className="text-sm md:text-base font-extrabold text-slate-900 leading-snug tracking-tight">
              {currentStep.title}
            </h4>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-normal">
              {currentStep.description}
            </p>

            {/* Optional Pro Tip Box */}
            {currentStep.tip && (
              <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-start gap-2 text-[11px] text-amber-950 font-medium leading-relaxed">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-amber-900">Mẹo hữu ích:</strong> {currentStep.tip}
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 mt-1">
            {/* Step Progress Dots */}
            <div className="flex items-center gap-1.5">
              {config.steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === currentStepIndex
                      ? "w-6 bg-indigo-600"
                      : idx < currentStepIndex
                      ? "w-2 bg-indigo-300"
                      : "w-2 bg-slate-200"
                  }`}
                  title={`Chuyển tới bước ${idx + 1}`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Bỏ qua
              </button>

              {!isFirstStep && (
                <button
                  type="button"
                  onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                  className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isLastStep) {
                    onClose();
                  } else {
                    setCurrentStepIndex((prev) => prev + 1);
                  }
                }}
                className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 text-white ${
                  isLastStep
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25"
                }`}
              >
                {isLastStep ? (
                  <>
                    <span>Đã hiểu & Hoàn tất</span>
                    <Check className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Tiếp theo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

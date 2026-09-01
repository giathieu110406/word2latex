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
  Layout,
  MousePointerClick
} from "lucide-react";

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  bullets?: string[];
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
        title: "1. Khung Soạn Thảo & Nhập Nguồn Công Thức",
        description:
          "Khu vực tiếp nhận văn bản học thuật và công thức toán học từ mọi nguồn tài liệu.",
        bullets: [
          "Hỗ trợ cả công thức nội dòng ($x^2 + y^2 = z^2$) và công thức hiển thị riêng dòng ($$\\int_0^1 f(x)dx$$).",
          "Tự động cảnh báo khi có công thức bị quên đóng dấu Đô-la ($) và hỗ trợ nút sửa nhanh với 1 click.",
          "Hỗ trợ dán trực tiếp hình ảnh chụp đề bài từ Clipboard (Ctrl+V) để AI nhận diện và trích xuất thành chữ.",
          "Nút 'Xóa sạch' giúp bạn nhanh chóng làm trống khung soạn thảo để bắt đầu tài liệu mới."
        ],
        tip: "Bạn có thể gõ phím tắt hoặc dán văn bản có sẵn cấu trúc bảng Markdown/HTML vào đây.",
        position: "right",
      },
      {
        targetId: "tour-latex-font-controls",
        title: "2. Chọn Phông Chữ & Định Dạng Word",
        description:
          "Bộ công cụ kiểm soát phông chữ và định dạng thẩm mỹ khi xuất sang Microsoft Word.",
        bullets: [
          "Lựa chọn phông chữ đích: Times New Roman (chuẩn thể thức văn bản Việt Nam), Inter, Arial hoặc Calibri.",
          "Công thức toán học sẽ tự động được định dạng đồng bộ và chuyển thành chuẩn Microsoft Equation tương thích.",
          "Sử dụng 2 nút B (In đậm) và I (In nghiêng) để định dạng nhanh đoạn văn bản bạn đang bôi đen."
        ],
        tip: "Times New Roman là phông chữ mặc định chuẩn cho các tài liệu khoa học, đề thi THPT và giáo trình.",
        position: "bottom",
      },
      {
        targetId: "tour-latex-ai-canvas",
        title: "3. Trợ Lý AI Canvas & Xử Lý Ảnh Chuyên Sâu",
        description:
          "Công cụ Trí tuệ Nhân tạo thông minh hỗ trợ nâng cấp và hiệu chỉnh tài liệu trực tiếp.",
        bullets: [
          "Dịch thuật toàn bộ tài liệu sang tiếng Anh hoặc tiếng Việt mà vẫn bảo toàn 100% công thức LaTeX.",
          "Tự động thêm lời giải, các bước giải thích chi tiết cho từng bài toán trong văn bản.",
          "Tìm kiếm và in đậm các từ khóa chuyên ngành, định lý, định luật quan trọng.",
          "Tạo các câu hỏi/bài tập toán học tương tự đi kèm đáp án và hướng dẫn giải."
        ],
        tip: "Bấm vào các thẻ gợi ý có sẵn phía dưới thanh AI Canvas để thực hiện tác vụ tức thời.",
        position: "right",
      },
      {
        targetId: "tour-latex-preview-panel",
        title: "4. Xem Trước KaTeX & Xuất File Word Equation",
        description:
          "Khung hiển thị kết quả trực quan và các tùy chọn xuất bản tài liệu chất lượng cao.",
        bullets: [
          "Kết xuất công thức toán học sắc nét tức thời theo chuẩn KaTeX.",
          "Nút 'Sao chép': Dán thẳng vào Microsoft Word thành công thức Equation xịn sò (không bị vỡ hạt như ảnh).",
          "Nút 'Word': Tải trực tiếp file .doc/.docx hoàn chỉnh về máy tính với đầy đủ bảng biểu và công thức.",
          "Tab 'Tải PDF': Cung cấp mã nguồn LaTeX chuẩn cho Overleaf hoặc xuất file PDF in ấn trực tiếp."
        ],
        tip: "Sau khi bấm 'Sao chép', chỉ cần mở Word và nhấn Ctrl+V là công thức toán sẽ tự động hiển thị mượt mà.",
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
        title: "1. Cấu Hình Tiêu Đề & Đầu Trang Đề Thi",
        description:
          "Thiết lập thông tin hành chính của đề thi theo quy chuẩn giáo dục chuyên nghiệp.",
        bullets: [
          "Lựa chọn 2 phong cách đầu trang: 'Khung đôi Bộ GD' (Trường, Môn, Mã đề, Thông tin học sinh) hoặc 'Căn giữa' đơn giản.",
          "Tùy chỉnh linh hoạt: Tên trường/Sở GD, Tên kỳ thi, Môn thi, Mã đề thi và Thời gian làm bài.",
          "Nút 'Thu gọn (▲) / Mở rộng (▼)' giúp bạn ẩn bớt phần tiêu đề để tập trung tối đa không gian soạn câu hỏi."
        ],
        tip: "Khung đôi Bộ GD rất thích hợp cho các đề kiểm tra 15 phút, 1 tiết, học kỳ hoặc đề thi thử tốt nghiệp.",
        position: "bottom",
      },
      {
        targetId: "tour-qbuilder-type-selector",
        title: "2. Phân Loại 4 Dạng Câu Hỏi & Dán Thông Minh AI",
        description:
          "Hỗ trợ đầy đủ các dạng câu hỏi hiện đại của chương trình giáo dục mới.",
        bullets: [
          "4 dạng câu hỏi: Trắc nghiệm 4 lựa chọn (A,B,C,D), Đúng/Sai, Trả lời ngắn và Tự luận.",
          "Nút 'Dán thông minh (AI)': Dán nguyên văn câu trả lời từ ChatGPT/AI, hệ thống sẽ tự bóc tách câu hỏi, các phương án và đáp án vào đúng ô.",
          "Tùy chọn bố cục hiển thị đáp án: 1 cột (dài), 2 cột (vừa) hoặc 4 cột (ngắn gọn trên 1 dòng)."
        ],
        tip: "Bạn có thể nhập trực tiếp công thức toán học $...$ vào cả phần câu hỏi và phần đáp án giải chi tiết.",
        position: "right",
      },
      {
        targetId: "tour-qbuilder-saved-list",
        title: "3. Quản Lý & Chỉnh Sửa Danh Sách Câu Hỏi",
        description:
          "Bảng kiểm soát toàn bộ ngân hàng câu hỏi đã nạp vào đề thi hiện tại.",
        bullets: [
          "Các tab lọc thông minh: Xem tất cả hoặc lọc riêng từng dạng (Trắc nghiệm, Đúng/Sai, Trả lời ngắn, Tự luận).",
          "Đổi số cột hiển thị đáp án (1C, 2C, 4C) trực tiếp trên từng câu hỏi trong bảng.",
          "Các nút mũi tên (▲/▼) giúp hoán đổi thứ tự câu hỏi và tự động đánh lại số Câu 1, Câu 2... một cách nhất quán.",
          "Nút 'Sửa' để đưa câu hỏi lên form chỉnh sửa và nút 'Xóa' để loại bỏ câu hỏi khỏi đề."
        ],
        tip: "Bấm vào tiêu đề hoặc nội dung tóm tắt của bất kỳ câu hỏi nào trong bảng để bắt đầu chỉnh sửa nhanh.",
        position: "right",
      },
      {
        targetId: "tour-qbuilder-export-panel",
        title: "4. Xáo Trộn Đề, Thay Số AI & Xuất File Word",
        description:
          "Xem trước bố cục toàn diện của đề thi và xuất bản tài liệu hoàn chỉnh.",
        bullets: [
          "Nút 'Trộn đề thi': Hoán vị ngẫu nhiên vị trí các câu hỏi và các phương án A, B, C, D để tạo nhiều mã đề khác nhau.",
          "Tính năng 'Thay số bằng AI': Tự động tạo bài toán mới bằng cách thay đổi số liệu nhưng vẫn giữ nguyên phương pháp giải.",
          "Nút 'Tải Word (.doc)': Xuất file đề thi chuẩn kèm khung thông tin, câu hỏi trình bày đẹp mắt và Bảng đáp án chi tiết ở cuối trang."
        ],
        tip: "File Word tải về có bảng đáp án phân bổ theo từng phần, giúp giáo viên dễ dàng chấm bài và in ấn phát cho học sinh.",
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
        title: "1. Tải Lên Tệp Đa Năng Hoặc Nhập URL",
        description:
          "Chuyển đổi mọi loại tài liệu học liệu và tài nguyên web sang định dạng Markdown chuẩn.",
        bullets: [
          "Hỗ trợ đa định dạng: Tệp PDF (1 đến 100+ trang), Word (.docx), PowerPoint (.pptx), Excel (.xlsx), Ảnh chụp tài liệu, File âm thanh bài giảng.",
          "Tab 'URL / Youtube': Nhập đường link bất kỳ từ website bài báo hoặc video YouTube để trích xuất nội dung bài giảng thành chữ.",
          "Kéo thả hoặc click vào khung để chọn file từ máy tính dễ dàng."
        ],
        tip: "Hệ thống sử dụng model Gemini 3.7 Flash với temperature: 0 để đảm bảo sao chép trung thực 100% không suy diễn.",
        position: "right",
      },
      {
        targetId: "tour-markitdown-queue-settings",
        title: "2. Cấu Hình Hàng Đợi & Phân Đoạn PDF Lớn",
        description:
          "Hệ thống hàng đợi thông minh giúp xử lý mượt mà tài liệu dung lượng lớn mà không lo lỗi quá tải.",
        bullets: [
          "Kích thước phân đoạn: Chia nhỏ PDF thành các gói 5, 10, 15 hoặc 20 trang để AI xử lý chính xác nhất.",
          "Khoảng nghỉ Cooldown: Tự động nghỉ giữa các đoạn (2.5s, 3.5s, 5.0s) để tránh chạm hạn mức giới hạn của Google AI.",
          "Tùy chọn 'Ghi chú mốc trang': Tự động chèn mốc ranh giới từng trang <!-- TRANG X - Y --> vào tài liệu kết quả."
        ],
        tip: "Với slide bài giảng nhiều hình vẽ và bảng biểu, nên chọn phân đoạn 10 hoặc 15 trang để AI tái hiện chi tiết nhất.",
        position: "right",
      },
      {
        targetId: "tour-markitdown-output-panel",
        title: "3. Theo Dõi Tiến Độ Hàng Đợi & Tải File Markdown",
        description:
          "Xem trước cấu trúc tài liệu sau khi chuyển đổi và lưu trữ kết quả thuận tiện.",
        bullets: [
          "Thanh tiến độ thời gian thực hiển thị số phân đoạn đã hoàn thành trên tổng số phân đoạn.",
          "Tính năng 'Thử lại' từng phân đoạn: Nếu gặp sự cố mạng ở một đoạn cụ thể, bạn chỉ cần bấm thử lại đoạn đó mà không cần xử lý lại từ đầu.",
          "Nút 'Sao chép': Copy toàn bộ nội dung Markdown chứa bảng biểu và công thức toán học vào bộ nhớ tạm.",
          "Nút 'Tải 1 file .md': Tải về tệp Markdown hoàn chỉnh để sử dụng trên Obsidian, Notion hoặc các nền tảng AI."
        ],
        tip: "Bạn có thể dán nội dung Markdown kết quả vào trang Chuyển đổi LaTeX để xuất ngược lại sang Word Equation bất cứ lúc nào.",
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
  const totalSteps = config.steps.length;

  // Handle advancing to next step or closing if on last step
  const handleAdvanceNext = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  }, [currentStepIndex, totalSteps, onClose]);

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
        setTimeout(() => {
          const updated = el.getBoundingClientRect();
          setTargetRect(updated);
        }, 250);
      }
    } else {
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
      } else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleAdvanceNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIndex, handleAdvanceNext, onClose]);

  if (!isOpen) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Calculate Popover Position relative to targetRect with safe viewport bounding
  const getPopoverStyle = (): React.CSSProperties => {
    const cardWidth = Math.min(420, window.innerWidth - 32);
    const estimatedHeight = cardRef.current?.offsetHeight || 380;
    const padding = 16;
    const topNavOffset = 70; // Clearance for top navigation
    const bottomNavOffset = 20;

    if (!targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: `${cardWidth}px`,
        maxHeight: `calc(100vh - 100px)`,
        zIndex: 99999,
      };
    }

    const { top, bottom, left, right, width } = targetRect;
    const prefPos = currentStep.position || "bottom";

    let posTop: number;
    let posLeft = left + width / 2 - cardWidth / 2;

    if (prefPos === "right" && right + cardWidth + padding < window.innerWidth - 10) {
      posLeft = right + padding;
      posTop = top;
    } else if (prefPos === "left" && left - cardWidth - padding > 10) {
      posLeft = left - cardWidth - padding;
      posTop = top;
    } else if (prefPos === "top" && top - estimatedHeight - padding >= topNavOffset) {
      posTop = top - estimatedHeight - padding;
    } else {
      // Preferred Bottom: check if fits below target
      if (bottom + estimatedHeight + padding <= window.innerHeight - bottomNavOffset) {
        posTop = bottom + padding;
      } else if (top - estimatedHeight - padding >= topNavOffset) {
        // Fits above target
        posTop = top - estimatedHeight - padding;
      } else {
        // If neither fits completely, place at bottom or top of viewport with scrollable card
        if (top > window.innerHeight / 2) {
          posTop = topNavOffset;
        } else {
          posTop = Math.max(topNavOffset, window.innerHeight - estimatedHeight - bottomNavOffset);
        }
      }
    }

    // Horizontal bounds clamping
    posLeft = Math.max(16, Math.min(posLeft, window.innerWidth - cardWidth - 16));
    
    // Vertical bounds clamping to ALWAYS guarantee full visibility
    const maxTop = window.innerHeight - estimatedHeight - bottomNavOffset;
    posTop = Math.max(topNavOffset, Math.min(posTop, maxTop));

    return {
      position: "fixed",
      top: `${posTop}px`,
      left: `${posLeft}px`,
      width: `${cardWidth}px`,
      maxHeight: `calc(100vh - ${posTop + bottomNavOffset}px)`,
      zIndex: 99999,
    };
  };

  // SVG mask dimensions for smooth spotlight cutout
  const spotPadding = 8;
  const spotX = targetRect ? Math.max(0, targetRect.left - spotPadding) : 0;
  const spotY = targetRect ? Math.max(0, targetRect.top - spotPadding) : 0;
  const spotW = targetRect ? targetRect.width + spotPadding * 2 : 0;
  const spotH = targetRect ? targetRect.height + spotPadding * 2 : 0;
  const spotRx = 16;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99990] overflow-hidden select-none">
        {/* SVG Backdrop with Spotlight Cutout. Clicking anywhere on the backdrop advances to next step! */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto transition-all duration-300 cursor-pointer"
          onClick={handleAdvanceNext}
          style={{ width: "100vw", height: "100vh" }}
          aria-label="Bấm vào khoảng trống để chuyển tiếp bước tiếp theo"
        >
          <title>Bấm vào khoảng trống để chuyển tiếp bước tiếp theo</title>
          <defs>
            <mask id="tour-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
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
            className="pointer-events-none fixed rounded-2xl border-2 border-indigo-400/90 shadow-[0_0_30px_rgba(99,102,241,0.55)] z-[99995]"
            style={{
              top: `${spotY}px`,
              left: `${spotX}px`,
              width: `${spotW}px`,
              height: `${spotH}px`,
            }}
          />
        )}

        {/* Floating backdrop click hint badge */}
        <div className="fixed top-4 right-4 z-[99996] pointer-events-none hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 text-[11px] font-semibold backdrop-blur-md shadow-lg">
          <MousePointerClick className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Click bất kỳ khoảng trống nào để sang bước kế tiếp</span>
        </div>

        {/* Popover Step Dialog Card */}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={getPopoverStyle()}
          className="bg-white/98 backdrop-blur-2xl border border-slate-200/90 shadow-[0_25px_60px_rgba(15,23,42,0.35)] rounded-3xl p-5 md:p-6 flex flex-col gap-3.5 text-slate-850 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-indigo-50 border border-indigo-100/60 shrink-0">
                {config.pageIcon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider truncate">
                  {config.pageTitle}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Bước <strong className="text-slate-850 font-black">{currentStepIndex + 1}</strong> / {totalSteps}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer shrink-0"
              title="Đóng hướng dẫn (Phím Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
            <h4 className="text-sm md:text-[15px] font-black text-slate-900 leading-snug tracking-tight">
              {currentStep.title}
            </h4>
            
            <p className="text-xs md:text-[13px] text-slate-650 leading-relaxed font-medium">
              {currentStep.description}
            </p>

            {/* Detailed Feature Bullets */}
            {currentStep.bullets && currentStep.bullets.length > 0 && (
              <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                {currentStep.bullets.map((bullet, bIdx) => (
                  <div key={bIdx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pro Tip Box */}
            {currentStep.tip && (
              <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-2xl flex items-start gap-2 text-[11px] md:text-xs text-amber-950 font-medium leading-relaxed shadow-3xs">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-amber-900">Mẹo hay:</strong> {currentStep.tip}
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            {/* Step Progress Dots */}
            <div className="flex items-center gap-1.5">
              {config.steps.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
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
                className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Bỏ qua
              </button>

              {!isFirstStep && (
                <button
                  type="button"
                  onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAdvanceNext}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 text-white ${
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
                    <span>Tiếp tục</span>
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

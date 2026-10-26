import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { CheckCircle2, Sparkles, FileText, Code2, Eye, RefreshCw, Copy, Check } from "lucide-react";
import katex from "katex";

export const Tex: React.FC<{ math: string; display?: boolean; className?: string }> = ({
  math,
  display = false,
  className = "",
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, { displayMode: display, throwOnError: false });
    } catch {
      return math;
    }
  }, [math, display]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

const GLYPHS = ["∫", "Σ", "π", "∛", "∞", "∂", "θ", "λ", "Ε", "≈", "∇", "Δ", "∮"];

export const ParticleField: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={"pointer-events-none absolute inset-0 overflow-hidden select-none " + className}>
      <div className="absolute top-[12%] left-[8%] text-indigo-400/12 font-serif text-3xl">∫</div>
      <div className="absolute top-[28%] right-[12%] text-violet-400/12 font-serif text-2xl">Σ</div>
      <div className="absolute bottom-[20%] left-[16%] text-blue-400/12 font-serif text-4xl">π</div>
      <div className="absolute bottom-[35%] right-[22%] text-indigo-400/12 font-serif text-2xl">∞</div>
      <div className="absolute top-[65%] left-[45%] text-sky-400/10 font-serif text-3xl">∂</div>
      <div className="absolute top-[15%] right-[35%] text-indigo-400/10 font-serif text-2xl">∇</div>
      <div className="absolute bottom-[10%] right-[8%] text-purple-400/12 font-serif text-3xl">Δ</div>
    </div>
  );
};

export const HeroVisual: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.2 });

  // Bắt đầu từ tab "word" (Word thô) khi người dùng ở Hero Banner
  const [activeTab, setActiveTab] = useState<"word" | "latex" | "preview">("word");
  const [autoRotate, setAutoRotate] = useState(true);
  const [copied, setCopied] = useState(false);

  // Reset về tab 'word' mỗi khi cuộn vào tầm nhìn
  useEffect(() => {
    if (isInView) {
      setActiveTab("word");
    }
  }, [isInView]);

  // Công thức tích phân lượng giác ngắn gọn chuẩn mực: Vừa vặn 1 dòng không bao giờ lướt ngang
  const sampleLatex = "I = \\int_0^{\\pi/2} \\sin^2 x\\,\\mathrm{d}x = \\frac{\\pi}{4}";
  const sampleWord = "I = ∫[0->pi/2] sin^2(x) dx = pi/4";

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleLatex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Tự động chuyển đổi luân phiên: chỉ chạy khi isInView và bật autoRotate
  useEffect(() => {
    if (!autoRotate || !isInView) return;
    const tabs: Array<"word" | "latex" | "preview"> = ["word", "latex", "preview"];
    const id = setInterval(() => {
      setActiveTab((prev) => {
        const nextIdx = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIdx];
      });
    }, 4000);
    return () => clearInterval(id);
  }, [autoRotate, isInView]);

  return (
    <div ref={containerRef} className="relative flex w-full max-w-lg lg:max-w-xl items-center justify-center">
      {/* Background ambient multi-color light glow */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-indigo-500/15 via-sky-400/15 to-purple-500/15 blur-xl opacity-60" />

      {/* Main Flat Card */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-200">
        {/* Card Header Bar - 1 HÀNG NGANG DUY NHẤT: 3 chấm tròn + tên file + 3 nút tab (Hiệu ứng Animate UI) */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-2.5 py-1.5 sm:px-3.5 sm:py-2 gap-2 whitespace-nowrap select-none overflow-hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-rose-400" />
            <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-400" />
            <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-1 text-[11px] font-bold text-slate-600 font-mono hidden sm:inline">Document_Transform.tex</span>
          </div>

          {/* Mode Switcher Tabs với hiệu ứng trượt mượt mà Animate UI (layoutId) */}
          <div className="relative flex items-center gap-0.5 rounded-xl bg-slate-200/60 p-0.5 shrink-0 max-w-full">
            {/* Tab 1: Word */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("word");
                setAutoRotate(false);
              }}
              className={"relative flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer z-10 " +
                (activeTab === "word" ? "text-indigo-700" : "text-slate-600 hover:text-slate-900")
              }
            >
              {activeTab === "word" && (
                <motion.span
                  layoutId="hero-visual-tab-pill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <FileText className="h-3 w-3" />
              <span>Word</span>
            </button>

            {/* Tab 2: Mã LaTeX */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("latex");
                setAutoRotate(false);
              }}
              className={"relative flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer z-10 " +
                (activeTab === "latex" ? "text-indigo-700" : "text-slate-600 hover:text-slate-900")
              }
            >
              {activeTab === "latex" && (
                <motion.span
                  layoutId="hero-visual-tab-pill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Code2 className="h-3 w-3" />
              <span><span className="hidden sm:inline">Mã </span>LaTeX</span>
            </button>

            {/* Tab 3: View */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("preview");
                setAutoRotate(false);
              }}
              className={"relative flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer z-10 " +
                (activeTab === "preview" ? "text-indigo-700" : "text-slate-600 hover:text-slate-900")
              }
            >
              {activeTab === "preview" && (
                <motion.span
                  layoutId="hero-visual-tab-pill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Eye className="h-3 w-3" />
              <span>View</span>
            </button>
          </div>
        </div>

        {/* Dynamic Content Area - KHÓA CỐ ĐỊNH 100% CHIỀU CAO (h-[206px]), KHÔNG CO GIÃN 1 PIXEL NÀO */}
        <div className="h-[156px] sm:h-[206px] min-h-[156px] sm:min-h-[206px] max-h-[156px] sm:max-h-[206px] p-2 sm:p-4 flex flex-col justify-between overflow-hidden">
          <AnimatePresence mode="wait">
            {/* TAB 1: WORD THÔ */}
            {activeTab === "word" && (
              <motion.div
                key="word"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="flex flex-col justify-between h-full"
              >
                {/* Header con */}
                <div className="flex items-center justify-between h-5 sm:h-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 font-bold text-[11px]">
                    <Sparkles className="h-3 w-3 animate-spin text-amber-600" />
                    <span>Nhận diện công thức từ Word (.docx)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRotate(!autoRotate)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                    title="Tự động lặp lại demo"
                  >
                    <RefreshCw className={"h-2.5 w-2.5 " + (autoRotate ? "animate-spin" : "")} />
                    <span>{autoRotate ? "Auto" : "Dừng"}</span>
                  </button>
                </div>

                {/* Khung nội dung chuẩn h-[112px] */}
                <div className="h-[82px] sm:h-[112px] w-full rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 flex flex-col justify-center text-center shadow-2xs">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                    Công thức toán gốc dạng Equation OMML:
                  </p>
                  <p className="font-mono text-xs sm:text-sm font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-3xs truncate">
                    {sampleWord}
                  </p>
                </div>

                {/* Footer con */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 px-1 h-4 sm:h-5">
                  <span>Trích xuất: <strong className="text-indigo-600 font-bold">Word Equation OMML</strong></span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Đã nhận diện chuẩn xác
                  </span>
                </div>
              </motion.div>
            )}

            {/* TAB 2: MÃ LATEX - KHÔNG BAO GIỜ BỊ SCROLL NGANG */}
            {activeTab === "latex" && (
              <motion.div
                key="latex"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="flex flex-col justify-between h-full"
              >
                {/* Header con */}
                <div className="flex items-center justify-between h-5 sm:h-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold text-[11px]">
                    <Code2 className="h-3 w-3 text-indigo-600" />
                    <span>Mã lệnh LaTeX chuẩn Overleaf</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRotate(!autoRotate)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                    title="Tự động lặp lại demo"
                  >
                    <RefreshCw className={"h-2.5 w-2.5 " + (autoRotate ? "animate-spin" : "")} />
                    <span>{autoRotate ? "Auto" : "Dừng"}</span>
                  </button>
                </div>

                {/* Khung nội dung chuẩn h-[112px] - Vừa khít 1 dòng 100% không lướt ngang */}
                <div className="h-[82px] sm:h-[112px] w-full rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-950 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 flex flex-col justify-center shadow-inner overflow-hidden">
                  <p className="text-[10px] font-mono text-slate-400 mb-1.5">Mã nguồn LaTeX tối ưu:</p>
                  <p className="font-mono text-xs sm:text-sm text-emerald-400 select-all truncate text-center font-semibold bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800/80">
                    {sampleLatex}
                  </p>
                </div>

                {/* Footer con */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 px-1 h-4 sm:h-5">
                  <span>Gói hỗ trợ: <strong className="text-indigo-600 font-bold">amsmath, amssymb</strong></span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Đã chép" : "Sao chép"}</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 3: KATEX VIEW - HIỂN THỊ TRỌN VẸN 100%, KHÔNG CẮT MẤT NỬA DƯỚI */}
            {activeTab === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="flex flex-col justify-between h-full"
              >
                {/* Header con */}
                <div className="flex items-center justify-between h-5 sm:h-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>KaTeX Math Rendering Engine</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRotate(!autoRotate)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                    title="Tự động lặp lại demo"
                  >
                    <RefreshCw className={"h-2.5 w-2.5 " + (autoRotate ? "animate-spin" : "")} />
                    <span>{autoRotate ? "Auto" : "Dừng"}</span>
                  </button>
                </div>

                {/* Khung nội dung chuẩn h-[112px] - Công thức toán to, đẹp, sắc nét, đầy đủ 100% không bị xén */}
                <div className="h-[82px] sm:h-[112px] w-full rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white px-2.5 sm:px-3.5 py-1 sm:py-2 flex flex-col justify-center text-center shadow-xs overflow-visible">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Công thức toán hoàn chỉnh:</p>
                  <div className="text-base sm:text-lg text-slate-900 py-0.5 flex items-center justify-center overflow-visible">
                    <Tex display math={sampleLatex} />
                  </div>
                </div>

                {/* Footer con */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 px-1 h-4 sm:h-5">
                  <span>Thời gian phân giải: <strong className="text-indigo-600 font-bold">120ms</strong></span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Chuẩn Overleaf &amp; MathJax
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom subtle progress line */}
        {autoRotate && (
          <motion.div
            key={activeTab}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4.0, ease: "linear" }}
            className="h-0.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400"
          />
        )}
      </div>
    </div>
  );
};

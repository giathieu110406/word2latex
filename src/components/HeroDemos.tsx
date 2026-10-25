import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  Copy, 
  FileText, 
  HelpCircle, 
  Compass, 
  FileSpreadsheet, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  BookOpen, 
  FileType, 
  Video, 
  FileCode2,
  Layers,
  ChevronRight,
  Download,
  FileDown,
  Loader2,
  Keyboard
} from "lucide-react";
import katex from "katex";
import { CopyMorphButton } from "./ui/CopyMorphButton";
import { downloadWordDocument } from "../utils/word-export";

export const Tex: React.FC<{ math: string; display?: boolean; className?: string }> = ({
  math,
  display = false,
  className = "",
}) => {
  const [html, setHtml] = useState("");
  useEffect(() => {
    try {
      setHtml(katex.renderToString(math, { displayMode: display, throwOnError: false }));
    } catch {
      setHtml(math);
    }
  }, [math, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

/* =========================================================================
   1. LATEX MINI-DEMO:
   - Vòng lặp vĩnh viễn (chạy liên tục, dừng 5s rồi lặp lại, bỏ nút bấm lại)
   - Chế độ 1 (Mặc định trước): Chuyển đổi công thức thô siêu tốc -> Translate -> Hiện KaTeX & Nút Sao chép cho Word
   - Chế độ 2: AI Canvas Sửa lỗi thông minh (Lúc đầu hiện lỗi, gõ prompt ngắn -> AI quét -> Ra kết quả & Chip)
   ========================================================================= */

const RAW_FORMULA_TEXT = "int_0^1 (x^2 * e^x) / (x + 1)^2 dx";
const RAW_FORMULA_LATEX = "\\int_0^1 \\frac{x^2 e^x}{(x+1)^2}\\,\\mathrm{d}x = \\frac{e}{2} - 1";

const CANVAS_ERR_CODE = "\\int \\frac{2x}{x^2 + 1 dx = ln(x^2 + 1";
const CANVAS_SIMPLE_PROMPT = "Sửa lỗi công thức này giúp tôi";
const CANVAS_FIXED_LATEX = "\\int \\frac{2x}{x^2 + 1}\\,\\mathrm{d}x = \\ln(x^2 + 1) + C";

export const LatexMiniDemo: React.FC<{ onExplore: () => void }> = ({ onExplore }) => {
  // Ref kiểm tra khi người dùng cuộn tới vùng nhìn thấy mới kích hoạt vòng lặp
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.25 });

  // Nút điều khiển tự động lặp (Auto / Dừng)
  const [autoPlay, setAutoPlay] = useState(true);

  // Đưa chế độ Chuyển đổi công thức thô lên trước làm mặc định
  const [activeTab, setActiveTab] = useState<"convert" | "canvas">("convert");

  // Reset về tab 'convert' mỗi khi cuộn vào vùng nhìn thấy
  useEffect(() => {
    if (isInView) {
      setActiveTab("convert");
      setConvertTyped("");
      setConvertStep("typing");
    }
  }, [isInView]);

  // State Chế độ 1: Chuyển đổi công thức thô
  const [convertTyped, setConvertTyped] = useState("");
  const [convertStep, setConvertStep] = useState<"typing" | "converting" | "done">("typing");

  // State Chế độ 2: AI Canvas Sửa lỗi
  const [canvasStep, setCanvasStep] = useState<"initial_err" | "typing_prompt" | "fixing" | "done">("initial_err");
  const [canvasPromptTyped, setCanvasPromptTyped] = useState("");

  // State sao chép & tải Word
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [wordDownloaded, setWordDownloaded] = useState(false);
  const [copiedForWord, setCopiedForWord] = useState(false);

  const katexContainerRef = useRef<HTMLDivElement>(null);

  /* -------------------------------------------------------------------------
     VÒNG LẶP CHẾ ĐỘ 1: CHUYỂN ĐỔI CÔNG THỨC THÔ
     - Chỉ chạy khi người dùng cuộn tới (isInView) && bật autoPlay
     - Chu kỳ lặp: 4 giây
     ------------------------------------------------------------------------- */
  useEffect(() => {
    if (activeTab !== "convert" || !isInView || !autoPlay) return;

    let isMounted = true;
    let timerId: any;
    let delayStartTimerId: any;

    const runConvertLoop = () => {
      if (!isMounted || !autoPlay) return;
      setConvertTyped("");
      setConvertStep("typing");

      let charIdx = 0;
      const typeFast = () => {
        if (!isMounted || !autoPlay) return;
        if (charIdx <= RAW_FORMULA_TEXT.length) {
          setConvertTyped(RAW_FORMULA_TEXT.slice(0, charIdx));
          charIdx++;
          timerId = setTimeout(typeFast, 28); // Giảm tốc độ gõ 50% (từ 14ms lên 28ms)
        } else {
          // Nhập xong -> Chuyển sang bước Converting (AI Translate)
          setConvertStep("converting");
          timerId = setTimeout(() => {
            if (!isMounted || !autoPlay) return;
            // Hiện kết quả bên phải
            setConvertStep("done");
            // Dừng 4 giây rồi lặp lại vòng lặp
            timerId = setTimeout(() => {
              if (isMounted && autoPlay) runConvertLoop();
            }, 4000);
          }, 350);
        }
      };

      timerId = setTimeout(typeFast, 200);
    };

    // Chờ delay 1.5 giây sau khi lướt tới rồi mới bắt đầu auto animation
    delayStartTimerId = setTimeout(() => {
      runConvertLoop();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(delayStartTimerId);
      clearTimeout(timerId);
    };
  }, [activeTab, isInView, autoPlay]);

  /* -------------------------------------------------------------------------
     VÒNG LẶP CHẾ ĐỘ 2: AI CANVAS SỬA LỖI
     - Chỉ chạy khi người dùng cuộn tới (isInView) && bật autoPlay
     - Chu kỳ lặp: 4 giây
     ------------------------------------------------------------------------- */
  useEffect(() => {
    if (activeTab !== "canvas" || !isInView || !autoPlay) return;

    let isMounted = true;
    let timerId: any;

    const runCanvasLoop = () => {
      if (!isMounted || !autoPlay) return;
      // Giai đoạn 1: Lúc đầu bên phải hiện lỗi cú pháp, chưa có kết quả hoàn thiện
      setCanvasStep("initial_err");
      setCanvasPromptTyped("");

      // Sau 1.2s bắt đầu nhập prompt đơn giản
      timerId = setTimeout(() => {
        if (!isMounted || !autoPlay) return;
        setCanvasStep("typing_prompt");

        let charIdx = 0;
        const typePromptFast = () => {
          if (!isMounted || !autoPlay) return;
          if (charIdx <= CANVAS_SIMPLE_PROMPT.length) {
            setCanvasPromptTyped(CANVAS_SIMPLE_PROMPT.slice(0, charIdx));
            charIdx++;
            timerId = setTimeout(typePromptFast, 36); // Giảm tốc độ gõ 50% (từ 18ms lên 36ms)
          } else {
            // Nhập xong prompt -> AI quét sửa lỗi
            setCanvasStep("fixing");
            timerId = setTimeout(() => {
              if (!isMounted || !autoPlay) return;
              // AI sửa xong -> Hiện kết quả hoàn chỉnh & các chip
              setCanvasStep("done");
              // Dừng 4 giây rồi lặp lại vòng lặp
              timerId = setTimeout(() => {
                if (isMounted && autoPlay) runCanvasLoop();
              }, 4000);
            }, 550);
          }
        };

        typePromptFast();
      }, 1200);
    };

    runCanvasLoop();

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [activeTab, isInView, autoPlay]);

  // Xử lý sao chép cho Word
  const handleCopyForWord = async () => {
    const mathText = activeTab === "convert" ? RAW_FORMULA_LATEX : CANVAS_FIXED_LATEX;
    try {
      if (katexContainerRef.current) {
        // Tạo clipboard text/html chuẩn MathML cho Word
        const mathMlEl = katexContainerRef.current.querySelector("math");
        if (mathMlEl && typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([mathMlEl.outerHTML], { type: "text/html" }),
              "text/plain": new Blob([mathText], { type: "text/plain" }),
            }),
          ]);
        } else {
          await navigator.clipboard.writeText(mathText);
        }
      } else {
        await navigator.clipboard.writeText(mathText);
      }
    } catch {
      await navigator.clipboard.writeText(mathText);
    }
    setCopiedForWord(true);
    setTimeout(() => setCopiedForWord(false), 2000);
  };

  // Xử lý tải tài liệu Word (.docx)
  const handleDownloadWord = async () => {
    if (!katexContainerRef.current || isDownloadingWord) return;
    setIsDownloadingWord(true);

    try {
      await downloadWordDocument(
        katexContainerRef.current,
        "Times New Roman",
        activeTab === "convert" ? "Cong_thuc_Tich_phan.docx" : "Cong_thuc_AI_Canvas.docx"
      );
      setWordDownloaded(true);
      setTimeout(() => setWordDownloaded(false), 3000);
    } catch (err) {
      console.error("Lỗi khi xuất file Word:", err);
    } finally {
      setIsDownloadingWord(false);
    }
  };

  return (
    <div ref={containerRef} className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 sm:p-7 shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Word Equation &rarr; LaTeX Siêu Tốc &bull; AI Canvas Tự Động
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mô phỏng tự động liên tục: Chuyển đổi công thức thô sang Word Equation và trợ lý AI Canvas sửa lỗi cú pháp.
          </p>
        </div>

        <button
          onClick={onExplore}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all cursor-pointer hover:scale-105"
        >
          <span>Mở Trình Chuyển Đổi</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs & Nút điều khiển Auto / Dừng */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Chế độ:</span>
          
          {/* Container Tab phong cách Animate-UI Segmented Control */}
          <div className="flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 relative">
            {/* Tab 1: Chuyển Đổi Công Thức Thô */}
            <button
              type="button"
              onClick={() => setActiveTab("convert")}
              className={"relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer z-10 " +
                (activeTab === "convert" ? "text-indigo-700" : "text-slate-600 hover:text-slate-900")
              }
            >
              {activeTab === "convert" && (
                <motion.span
                  layoutId="hero-demos-active-pill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Keyboard className="w-3.5 h-3.5" />
              <span>Chuyển Đổi Công Thức Thô</span>
            </button>

            {/* Tab 2: AI Canvas (Bỏ icon AI màu vàng, không còn chữ Siêu Tốc) */}
            <button
              type="button"
              onClick={() => setActiveTab("canvas")}
              className={"relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer z-10 " +
                (activeTab === "canvas" ? "text-indigo-700" : "text-slate-600 hover:text-slate-900")
              }
            >
              {activeTab === "canvas" && (
                <motion.span
                  layoutId="hero-demos-active-pill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>AI Canvas: Sửa Lỗi Tự Động</span>
            </button>
          </div>
        </div>

        {/* NÚT AUTO TINH GỌN THEO ĐÚNG HÌNH THIẾT KẾ CỦA HEROVISUAL */}
        <button
          type="button"
          onClick={() => setAutoPlay(!autoPlay)}
          className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50 transition-all select-none"
          title="Tự động lặp lại mô phỏng"
        >
          <RefreshCw className={"w-3 h-3 " + (autoPlay && isInView ? "animate-spin" : "")} />
          <span>{autoPlay ? "Auto" : "Dừng"}</span>
        </button>
      </div>

      {/* NỘI DUNG 2 CHẾ ĐỘ - KHÓA CỐ ĐỊNH CHIỀU CAO h-[270px] KHÔNG CO GIÃN 1 PIXEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-1">
        {/* =============================================================
            CHẾ ĐỘ 1: CHUYỂN ĐỔI CÔNG THỨC THÔ (NHẬP NHANH -> TRANSLATE -> HIỆN KẾT QUẢ)
            ============================================================= */}
        {activeTab === "convert" ? (
          <>
            {/* Cột trái: Nhập công thức thô siêu nhanh - Khóa cứng h-[270px] */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 flex flex-col justify-between h-[270px] min-h-[270px] max-h-[270px] shadow-2xs">
              <div>
                <div className="h-6 flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <Keyboard className="w-3.5 h-3.5" />
                    Công thức toán thô (Gõ tắt Word Equation)
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    Fast Input
                  </span>
                </div>

                <div className="h-[148px] rounded-xl border border-dashed border-slate-300 bg-white p-4 font-mono text-xs sm:text-sm text-slate-900 font-bold leading-relaxed flex items-center relative overflow-hidden shadow-2xs">
                  <div className="w-full">
                    <span>{convertTyped}</span>
                    {convertStep === "typing" && (
                      <span className="inline-block w-2 h-4 bg-indigo-600 ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              </div>

              <div className="h-6 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                <span className="flex items-center gap-1.5">
                  <span className={"h-2 w-2 rounded-full " + (convertStep === "typing" ? "bg-amber-500 animate-ping" : convertStep === "converting" ? "bg-indigo-500 animate-spin" : "bg-emerald-500")} />
                  <span>
                    {convertStep === "typing" ? "Đang gõ công thức siêu tốc..." : convertStep === "converting" ? "AI đang translate cú pháp..." : "Đã chuyển đổi hoàn tất"}
                  </span>
                </span>
                <span className="font-bold text-indigo-600">0.05s</span>
              </div>
            </div>

            {/* Cột phải: Chỉ hiện kết quả khi nhập xong + Nút cùng 1 hàng ngang - Khóa cứng h-[270px] */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden shadow-sm h-[270px] min-h-[270px] max-h-[270px]">
              {/* Tia sáng Beam khi đang Translate */}
              {convertStep === "converting" && (
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 0.35, ease: "linear" }}
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-600 to-transparent"
                />
              )}

              <div>
                {/* 1 HÀNG NGANG DUY NHẤT: Tiêu đề + 2 Nút (nowrap, không rớt dòng) */}
                <div className="h-7 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 mb-2 whitespace-nowrap">
                  <span className="flex items-center gap-1.5 text-indigo-700 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Kết quả hiển thị KaTeX</span>
                  </span>

                  {/* Hành động: Nút Tải Word & Nút Sao chép cho Word */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadWord}
                      disabled={isDownloadingWord || convertStep !== "done"}
                      className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-3xs shrink-0 " +
                        (wordDownloaded
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 active:scale-95 disabled:opacity-50")
                      }
                      title="Xuất tài liệu Word (.docx) chứa Equation chuẩn"
                    >
                      {isDownloadingWord ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : wordDownloaded ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>{wordDownloaded ? "Đã tải Word!" : isDownloadingWord ? "Đang tạo..." : "Tải Word (.docx)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyForWord}
                      disabled={convertStep !== "done"}
                      className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-3xs shrink-0 " +
                        (copiedForWord
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 active:scale-95 disabled:opacity-50")
                      }
                      title="Sao chép dưới định dạng Word Equation (MathML / OMML)"
                    >
                      {copiedForWord ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedForWord ? "Đã chép cho Word!" : "Sao chép cho Word"}</span>
                    </button>
                  </div>
                </div>

                {/* Khung KaTeX mở rộng h-[148px] bằng chính xác khung bên trái sau khi xóa dòng MathML */}
                <div 
                  ref={katexContainerRef}
                  className="h-[148px] min-h-[148px] max-h-[148px] rounded-xl border border-indigo-100/80 bg-white p-3 text-center flex items-center justify-center overflow-x-auto shadow-inner"
                >
                  {convertStep === "typing" ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span>Đang chờ hoàn tất nhập công thức thô...</span>
                    </div>
                  ) : convertStep === "converting" ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                      <Sparkles className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>AI đang chuyển đổi sang KaTeX &amp; Word Equation...</span>
                    </div>
                  ) : (
                    <Tex display math={RAW_FORMULA_LATEX} className="text-base sm:text-lg text-slate-900" />
                  )}
                </div>
              </div>

              <div className="h-6 flex items-center justify-between text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
                <span className="truncate max-w-[240px] text-[11px]">
                  {convertStep === "done" ? RAW_FORMULA_LATEX : "---"}
                </span>
                <span className="font-sans font-bold text-emerald-600 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Chuẩn Word Equation OMML
                </span>
              </div>
            </div>
          </>
        ) : (
          /* =============================================================
              CHẾ ĐỘ 2: AI CANVAS - LÚC ĐẦU HIỆN LỖI, GÕ PROMPT NGẮN -> AI SỬA XONG MỚI HIỆN KẾT QUẢ
              ============================================================= */
          <>
            {/* Cột trái: Công thức lỗi + Prompt ngắn đơn giản - Khóa cứng h-[270px] */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 flex flex-col justify-between h-[270px] min-h-[270px] max-h-[270px] shadow-2xs">
              <div>
                <div className="h-6 flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    Công thức đầu vào (Bị lỗi cú pháp)
                  </span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Lỗi cú pháp
                  </span>
                </div>

                {/* Khung công thức lỗi chuẩn h-[52px] */}
                <div className="h-[52px] rounded-xl border border-rose-200 bg-rose-50/30 px-3 py-1.5 font-mono text-xs text-rose-900 mb-2 shadow-2xs flex flex-col justify-center">
                  <span className="text-slate-400 select-none text-[10px] block mb-0.5">% Mã LaTeX lỗi: thiếu dấu &apos;&#125;&apos;, thiếu dx</span>
                  <p className="font-bold text-rose-600 line-through decoration-rose-400 select-all truncate text-[11px]">
                    {CANVAS_ERR_CODE}
                  </p>
                </div>

                {/* Hộp lệnh Prompt đơn giản hóa chuẩn h-[88px] */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                    <span className="flex items-center gap-1 text-indigo-700">
                      <Sparkles className="w-3 h-3" />
                      Lệnh prompt yêu cầu AI Canvas:
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Simple Prompt</span>
                  </div>

                  <div className="h-[56px] rounded-xl border border-indigo-200/80 bg-white px-3 py-2 font-sans text-xs text-indigo-950 font-bold flex items-center relative shadow-3xs">
                    <span>{canvasPromptTyped}</span>
                    {canvasStep === "typing_prompt" && (
                      <span className="inline-block w-1.5 h-3.5 bg-indigo-600 ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>

              <div className="h-6 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/70">
                <span className="flex items-center gap-1">
                  <span className={"w-2 h-2 rounded-full " + (canvasStep === "fixing" ? "bg-amber-500 animate-ping" : canvasStep === "done" ? "bg-emerald-500" : "bg-rose-500")} />
                  <span>
                    {canvasStep === "initial_err" ? "Chờ ra lệnh sửa lỗi..." : canvasStep === "typing_prompt" ? "Đang nhập yêu cầu..." : canvasStep === "fixing" ? "AI Canvas đang khắc phục lỗi..." : "Đã sửa lỗi hoàn thiện"}
                  </span>
                </span>
                <span className="font-bold text-indigo-600">AI Assistant</span>
              </div>
            </div>

            {/* Cột phải: Lúc đầu hiện lỗi cú pháp, sau khi AI chạy xong mới hiện kết quả & chip - Khóa cứng h-[270px] */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden shadow-sm h-[270px] min-h-[270px] max-h-[270px]">
              {/* Beam khi đang sửa lỗi */}
              {canvasStep === "fixing" && (
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-600 to-transparent"
                />
              )}

              <div>
                {/* 1 HÀNG NGANG DUY NHẤT: Tiêu đề kết quả + Nút Tải Word + Sao chép cho Word (nowrap, không rớt dòng) */}
                <div className="h-7 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 mb-2 whitespace-nowrap">
                  {canvasStep === "done" ? (
                    <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Kết quả AI Canvas đã hoàn thiện</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-200 shrink-0">
                      <HelpCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Trạng thái công thức hiện tại</span>
                    </span>
                  )}

                  {/* Actions cùng 1 hàng */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadWord}
                      disabled={isDownloadingWord || canvasStep !== "done"}
                      className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-3xs shrink-0 " +
                        (wordDownloaded
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 active:scale-95 disabled:opacity-50")
                      }
                      title="Xuất tài liệu Word (.docx) chuẩn Equation"
                    >
                      {isDownloadingWord ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : wordDownloaded ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>{wordDownloaded ? "Đã tải Word!" : isDownloadingWord ? "Đang tạo..." : "Tải Word (.docx)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyForWord}
                      disabled={canvasStep !== "done"}
                      className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-3xs shrink-0 " +
                        (copiedForWord
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 active:scale-95 disabled:opacity-50")
                      }
                      title="Sao chép dưới định dạng Word Equation (MathML / OMML)"
                    >
                      {copiedForWord ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedForWord ? "Đã chép cho Word!" : "Sao chép cho Word"}</span>
                    </button>
                  </div>
                </div>

                {/* Khung KaTeX chuẩn h-[110px] */}
                <div 
                  ref={katexContainerRef}
                  className="h-[110px] min-h-[110px] max-h-[110px] rounded-xl border border-indigo-100/80 bg-white p-3 text-center flex items-center justify-center overflow-x-auto shadow-inner"
                >
                  {canvasStep === "initial_err" || canvasStep === "typing_prompt" ? (
                    <div className="flex flex-col items-center justify-center gap-1 text-xs text-rose-600">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Cảnh báo cú pháp: Thiếu dấu đóng ngoặc &apos;&#125;&apos; và vi phân dx
                      </span>
                      <span className="text-[11px] text-slate-400">Đang chờ lệnh từ AI Canvas để tự động sửa chữa...</span>
                    </div>
                  ) : canvasStep === "fixing" ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>AI Canvas đang tái cấu trúc và bù khuyết cú pháp...</span>
                    </div>
                  ) : (
                    <Tex display math={CANVAS_FIXED_LATEX} className="text-base sm:text-lg text-slate-900" />
                  )}
                </div>

                {/* KHU VỰC CHIPS THÔNG BÁO CỐ ĐỊNH h-[30px] DÙ Ở BẤT KỲ BƯỚC NÀO (KHÔNG LÀM NHẢY KHUNG) */}
                <div className="h-[30px] mt-2 grid grid-cols-2 gap-2 text-[10.5px]">
                  {canvasStep === "done" ? (
                    <>
                      <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50/90 px-2 rounded-md border border-emerald-100 font-semibold shadow-3xs truncate">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">Đã sửa đóng ngoặc nhọn &#125;</span>
                      </div>
                      <div className="flex items-center gap-1 text-indigo-700 bg-indigo-50/90 px-2 rounded-md border border-indigo-100 font-semibold shadow-3xs truncate">
                        <Check className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="truncate">Đã bổ sung vi phân dx &amp; +C</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 text-rose-600 bg-rose-50/60 px-2 rounded-md border border-rose-100/80 font-medium truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="truncate">Thiếu dấu đóng ngoặc &#125;</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-600 bg-amber-50/60 px-2 rounded-md border border-amber-100/80 font-medium truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">Thiếu vi phân \mathrm&#123;d&#125;x</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="h-6 flex items-center justify-between text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
                <span className="truncate max-w-[240px] text-[11px]">
                  {canvasStep === "done" ? CANVAS_FIXED_LATEX : CANVAS_ERR_CODE}
                </span>
                <span className="font-sans font-bold text-emerald-600 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Chuẩn Overleaf &amp; Word
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
/* =========================================================================
   2. EXAM MINI-DEMO: Soạn Đề Thi & Hiển Thị Đề Thi Hoàn Chỉnh (3 Cảnh chuyển đổi)
   - Cảnh 1: Quét & Phân Loại Câu Hỏi (OCR & Bóc Tách)
   - Cảnh 2: Soạn Thảo Ma Trận & Trộn Đề Thi (Format Mới 2025 Bộ GD&ĐT)
   - Cảnh 3: Hiện Đề Thi In Chuẩn Trang Giấy A4 (Official Exam Paper Preview)
   ========================================================================= */

export const ExamMiniDemo: React.FC<{ onExplore: () => void }> = ({ onExplore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.2 });

  // Bắt đầu từ Cảnh 1: Bóc tách câu hỏi ("scan")
  const [currentScene, setCurrentScene] = useState<"scan" | "compose" | "paper">("scan");
  const [autoPlay, setAutoPlay] = useState(true);
  const [examCode, setExamCode] = useState("102");
  const [isShuffling, setIsShuffling] = useState(false);

  // Reset về cảnh 1 khi cuộn tới
  useEffect(() => {
    if (isInView) {
      setCurrentScene("scan");
    }
  }, [isInView]);

  // Tự động chuyển cảnh khi bật AutoPlay và trong tầm nhìn (delay 1.5 giây sau khi cuộn tới)
  useEffect(() => {
    if (!autoPlay || !isInView) return;
    const scenes: Array<"scan" | "compose" | "paper"> = ["scan", "compose", "paper"];
    let timer: any;
    const delayTimer = setTimeout(() => {
      timer = setInterval(() => {
        setCurrentScene(prev => {
          const nextIdx = (scenes.indexOf(prev) + 1) % scenes.length;
          return scenes[nextIdx];
        });
      }, 4500);
    }, 1500);
    return () => {
      clearTimeout(delayTimer);
      if (timer) clearInterval(timer);
    };
  }, [autoPlay, isInView]);

  // Hành động trộn đề
  const handleShuffle = () => {
    setIsShuffling(true);
    const codes = ["101", "102", "103", "104", "201", "202"];
    const randomCode = codes[Math.floor(Math.random() * codes.length)];
    setTimeout(() => {
      setExamCode(randomCode);
      setIsShuffling(false);
    }, 400);
  };

  return (
    <div ref={containerRef} className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            QBuilder &bull; Quét Câu Hỏi &bull; Soạn Đề Ma Trận &bull; Xuất Bản Đề Thi
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quy trình hoàn chỉnh từ bóc tách câu hỏi, trộn đảo đề đến xuất bản trang đề thi in ấn chuẩn Bộ GD&amp;ĐT.
          </p>
        </div>

        <button
          onClick={onExplore}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-500/20 transition-all cursor-pointer hover:scale-105"
        >
          <span>Mở Trình Soạn Đề</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 3 Cảnh Chuyển Đổi (Scene Switcher Tabs) - Phong cách Animate-UI */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-4">
        {/* Step Tabs với animated layoutId */}
        <div className="flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 relative">
          <button
            type="button"
            onClick={() => {
              setCurrentScene("scan");
              setAutoPlay(false);
            }}
            className={"relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer z-10 " +
              (currentScene === "scan" ? "text-purple-700" : "text-slate-600 hover:text-slate-900")
            }
          >
            {currentScene === "scan" && (
              <motion.span
                layoutId="exam-scene-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-extrabold">1</span>
            <span>Bóc Tách Câu Hỏi</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentScene("compose");
              setAutoPlay(false);
            }}
            className={"relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer z-10 " +
              (currentScene === "compose" ? "text-purple-700" : "text-slate-600 hover:text-slate-900")
            }
          >
            {currentScene === "compose" && (
              <motion.span
                layoutId="exam-scene-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-extrabold">2</span>
            <span>Soạn Ma Trận &amp; Trộn Đề</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentScene("paper");
              setAutoPlay(false);
            }}
            className={"relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer z-10 " +
              (currentScene === "paper" ? "text-purple-700" : "text-slate-600 hover:text-slate-900")
            }
          >
            {currentScene === "paper" && (
              <motion.span
                layoutId="exam-scene-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-extrabold">3</span>
            <span>Hiện Đề Thi Chuẩn A4</span>
          </button>
        </div>

        {/* Nút Auto Play demo kiểu Animate-UI nhỏ gọn */}
        <button
          type="button"
          onClick={() => setAutoPlay(!autoPlay)}
          className="text-xs font-bold text-slate-400 hover:text-purple-600 flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50 transition-all select-none"
          title="Tự động lặp lại mô phỏng"
        >
          <RefreshCw className={"w-3 h-3 " + (autoPlay ? "animate-spin text-purple-600" : "")} />
          <span>{autoPlay ? "Auto" : "Dừng"}</span>
        </button>
      </div>

      {/* KHUNG NỘI DUNG 3 CẢNH - CỐ ĐỊNH CHIỀU CAO h-[340px] TRÁNH NHẢY KHUNG VÀ GIẬT LAG */}
      <div className="mt-2 h-[340px] min-h-[340px] max-h-[340px] overflow-hidden relative">
        <AnimatePresence mode="wait">
          {/* =============================================================
              CẢNH 1: QUÉT & BÓC TÁCH CÂU HỎI TỰ ĐỘNG
              ============================================================= */}
          {currentScene === "scan" && (
            <motion.div
              key="scene-scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full"
            >
              {/* Bên trái: Văn bản đề thô nhập vào */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 flex flex-col justify-between h-[340px]">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-purple-600" />
                      Văn bản đề thô từ Word / OCR ảnh
                    </span>
                    <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-700 border border-purple-100">
                      Chưa định dạng
                    </span>
                  </div>
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3.5 text-xs text-slate-700 leading-relaxed font-mono min-h-[140px]">
                    Câu 12: Cho hàm số y = f(x) liên tục trên R và có bảng xét dấu đạo hàm như hình vẽ. Hàm số đã cho đạt cực đại tại điểm nào?<br className="my-1" />
                    A. x = 2&nbsp;&nbsp;&nbsp;&nbsp;B. x = -1<br />
                    C. x = 1&nbsp;&nbsp;&nbsp;&nbsp;D. x = 0
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Phát hiện: <strong>Nhận biết &amp; Thông hiểu</strong></span>
                  <span className="text-purple-600 font-bold">Chuẩn đề Bộ GD&amp;ĐT</span>
                </div>
              </div>

              {/* Bên phải: Kết quả bóc tách thẻ thông minh kèm hình học */}
              <div className="lg:col-span-7 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/30 via-white to-indigo-50/20 p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden shadow-sm h-[340px]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white font-extrabold text-[11px]">
                        CÂU 12
                      </span>
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                        Phần I: 4 Lựa chọn
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">Độ khó: Thông hiểu (0.25đ)</span>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                    Cho hàm số <Tex math="y = f(x)" /> liên tục trên <Tex math="\mathbb{R}" /> và có bảng xét dấu đạo hàm. Điểm cực đại của hàm số đã cho là:
                  </p>

                  {/* 4 phương án */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-emerald-300 bg-emerald-50/70 text-xs font-semibold text-emerald-900">
                      <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">A</span>
                      <Tex math="x = 2" />
                      <span className="ml-auto text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">Đúng</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">B</span>
                      <Tex math="x = -1" />
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">C</span>
                      <Tex math="x = 1" />
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">D</span>
                      <Tex math="x = 0" />
                    </div>
                  </div>

                  {/* Lời giải */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-[11px] text-slate-600 leading-relaxed">
                    <strong className="text-indigo-900 block mb-0.5">Lời giải nhanh:</strong>
                    Đạo hàm <Tex math="f'(x)" /> đổi dấu từ dương sang âm khi qua điểm <Tex math="x = 2" />.<br />
                    Do đó điểm cực đại của hàm số là <Tex math="x = 2" />.
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end">
                  <button
                    onClick={() => setCurrentScene("compose")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                  >
                    <span>Tiếp tục sang bước Soạn đề</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* =============================================================
              CẢNH 2: SOẠN THẢO MA TRẬN & TRỘN ĐỀ THI (Exam Composer)
              ============================================================= */}
          {currentScene === "compose" && (
            <motion.div
              key="scene-compose"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full"
            >
              {/* Bảng điều khiển cấu hình đề thi (5 cols) */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 flex flex-col justify-between h-[340px]">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-3">
                    <span className="flex items-center gap-1.5 text-purple-700">
                      <Layers className="w-3.5 h-3.5" />
                      Cấu trúc đề thi THPT 2025
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      Tổng 22 câu &bull; 10 Điểm
                    </span>
                  </div>

                  {/* 3 Phần chuẩn đề thi mới */}
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                        <span>Phần I: Trắc nghiệm 4 lựa chọn</span>
                        <span className="text-purple-600">12 câu (3.0đ)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-purple-600 h-1.5 rounded-full w-full" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                        <span>Phần II: Đúng / Sai (16 lệnh hỏi)</span>
                        <span className="text-indigo-600">4 câu (4.0đ)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-600 h-1.5 rounded-full w-full" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                        <span>Phần III: Trả lời ngắn</span>
                        <span className="text-sky-600">6 câu (3.0đ)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-sky-600 h-1.5 rounded-full w-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nút hành động trộn đề */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={handleShuffle}
                    disabled={isShuffling}
                    className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer active:scale-98 transition-all"
                  >
                    <RefreshCw className={"w-3.5 h-3.5 " + (isShuffling ? "animate-spin" : "")} />
                    <span>Trộn đề ngẫu nhiên (Mã {examCode})</span>
                  </button>
                </div>
              </div>

              {/* Bên phải: Danh sách câu hỏi đang được sắp xếp ma trận (7 cols) */}
              <div className="lg:col-span-7 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/20 via-white to-slate-50 p-4 sm:p-5 flex flex-col justify-between shadow-sm h-[340px]">
                <div>
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-bold text-slate-700">Xem trước ma trận câu hỏi (Mã đề {examCode}):</span>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                      Tự động hoán vị A/B/C/D
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {/* Item 1 */}
                    <div className="p-2.5 rounded-xl border border-slate-200/80 bg-white shadow-3xs flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded mr-1.5">
                          CÂU 1
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          Cho hàm số <Tex math="y = f(x)" /> có bảng biến thiên... Tìm số điểm cực trị.
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                        Đáp án: C
                      </span>
                    </div>

                    {/* Item 2 */}
                    <div className="p-2.5 rounded-xl border border-slate-200/80 bg-white shadow-3xs flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mr-1.5">
                          CÂU 2 (Đ/S)
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          Một vật thể chuyển động có phương trình vận tốc... a) Đúng b) Sai c) Đúng d) Sai
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                        Đ-S-Đ-S
                      </span>
                    </div>

                    {/* Item 3 */}
                    <div className="p-2.5 rounded-xl border border-slate-200/80 bg-white shadow-3xs flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded mr-1.5">
                          CÂU 3 (TLN)
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          Tính giá trị nhỏ nhất của hàm số trên đoạn [1; 3].
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded shrink-0">
                        Kết quả: 4.5
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Đã sẵn sàng dàn trang in A4</span>
                  <button
                    onClick={() => setCurrentScene("paper")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                  >
                    <span>Xem tờ đề thi hoàn chỉnh</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* =============================================================
              CẢNH 3: HIỆN ĐỀ THI IN CHUẨN A4 BỘ GD&ĐT (Official Paper View)
              ============================================================= */}
          {currentScene === "paper" && (
            <motion.div
              key="scene-paper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-md relative overflow-hidden font-serif min-h-[340px] flex flex-col justify-between"
            >
              {/* Thẻ đóng dấu 'ĐỀ CHÍNH THỨC' */}
              <div className="absolute top-3.5 right-4 rotate-6 border-2 border-rose-500 text-rose-600 font-sans font-black text-[10px] uppercase px-2 py-0.5 rounded tracking-widest opacity-80 select-none">
                ĐỀ THI CHÍNH THỨC
              </div>

              {/* Header Tờ Đề Thi Chuẩn */}
              <div className="grid grid-cols-2 gap-4 pb-2.5 border-b-2 border-slate-800 text-xs text-slate-900">
                <div className="text-center font-sans">
                  <p className="font-bold uppercase tracking-tight text-[10.5px]">SỞ GIÁO DỤC VÀ ĐÀO TẠO</p>
                  <p className="font-extrabold uppercase text-[11.5px] text-purple-900">TRƯỜNG THPT CHUYÊN TOÁN</p>
                  <p className="text-[9.5px] text-slate-500 mt-0.5">(Đề thi có 04 trang)</p>
                </div>

                <div className="text-center font-sans border-l border-slate-200 pl-4">
                  <p className="font-bold text-[10.5px] uppercase">KỲ THI THỬ TỐT NGHIỆP THPT NĂM 2025</p>
                  <p className="font-bold text-[10.5px]">BÀI THI: TOÁN HỌC</p>
                  <p className="text-[9.5px] text-slate-600">Thời gian làm bài: 90 phút (không kể phát đề)</p>
                  <div className="inline-block mt-0.5 font-mono font-bold bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[9.5px]">
                    MÃ ĐỀ THI: {examCode}
                  </div>
                </div>
              </div>

              {/* Khung thông tin thí sinh */}
              <div className="py-1.5 px-3 my-2 bg-slate-50/70 border border-slate-200 rounded-lg text-[10.5px] font-sans flex flex-wrap items-center justify-between gap-2 text-slate-700">
                <span>Họ và tên thí sinh: .....................................................................</span>
                <span>Số báo danh: ...........................................</span>
              </div>

              {/* Phần nội dung câu hỏi mô phỏng đề thi 2 cột */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-900 pt-0.5">
                {/* Câu 1 */}
                <div className="space-y-1 p-2 rounded-lg bg-slate-50/40 border border-slate-100">
                  <p className="font-bold text-[11.5px] leading-snug">
                    <span className="text-purple-800">Câu 1.</span> Cho hàm số <Tex math="y = f(x)" /> có đạo hàm <Tex math="f'(x) = x(x-1)^2" />. Số điểm cực trị của hàm số đã cho là:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[11px] pl-2 font-sans font-medium pt-0.5">
                    <span><strong>A.</strong> 1</span>
                    <span><strong>B.</strong> 2</span>
                    <span><strong>C.</strong> 0</span>
                    <span><strong>D.</strong> 3</span>
                  </div>
                </div>

                {/* Câu 2 kèm hình học */}
                <div className="space-y-1 p-2 rounded-lg bg-slate-50/40 border border-slate-100">
                  <p className="font-bold text-[11.5px] leading-snug">
                    <span className="text-purple-800">Câu 2.</span> Thể tích khối lăng trụ có diện tích đáy <Tex math="B = 6a^2" /> và chiều cao <Tex math="h = 3a" /> bằng:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[11px] pl-2 font-sans font-medium pt-0.5">
                    <span><strong>A.</strong> <Tex math="18a^3" /></span>
                    <span><strong>B.</strong> <Tex math="6a^3" /></span>
                    <span><strong>C.</strong> <Tex math="9a^3" /></span>
                    <span><strong>D.</strong> <Tex math="2a^3" /></span>
                  </div>
                </div>
              </div>

              {/* Phiếu trả lời trắc nghiệm mini ở góc */}
              <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs font-sans">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-800">Bảng đáp án trắc nghiệm:</span>
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full border border-purple-600 bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">1A</span>
                    <span className="w-5 h-5 rounded-full border border-purple-600 bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">2A</span>
                    <span className="w-5 h-5 rounded-full border border-slate-300 text-slate-600 flex items-center justify-center font-bold text-[10px]">3C</span>
                    <span className="w-5 h-5 rounded-full border border-slate-300 text-slate-600 flex items-center justify-center font-bold text-[10px]">4B</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onExplore()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200 hover:bg-purple-100 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Tải File Đề Thi Word (.docx)</span>
                  </button>
                  <button
                    onClick={() => setCurrentScene("scan")}
                    className="text-[11px] font-semibold text-slate-400 hover:text-purple-600 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Xem lại từ đầu</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
/* =========================================================================
   3. GEOMETRY MINI-DEMO: Workspace Vẽ hình (Mô tả lệnh -> SVG động từng nét)
   ========================================================================= */
export const GeometryMiniDemo: React.FC<{ onExplore: () => void }> = ({ onExplore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.25 });

  // Bắt đầu từ "Tam giác nội tiếp đường tròn" ("circle-triangle")
  const [shapeMode, setShapeMode] = useState<"circle-triangle" | "pyramid">("circle-triangle");
  const [autoPlay, setAutoPlay] = useState(true);
  const [drawProgress, setDrawProgress] = useState(1);

  const reanimate = () => {
    setDrawProgress(0);
    setTimeout(() => setDrawProgress(1), 50);
  };

  // Reset về tam giác nội tiếp khi cuộn tới
  useEffect(() => {
    if (isInView) {
      setShapeMode("circle-triangle");
      reanimate();
    }
  }, [isInView]);

  // Vòng lặp tự động chuyển đổi giữa 2 hình vẽ khi isInView và bật autoPlay (delay 1.5 giây sau khi cuộn tới)
  useEffect(() => {
    if (!autoPlay || !isInView) return;
    let timer: any;
    const delayTimer = setTimeout(() => {
      timer = setInterval(() => {
        setShapeMode(prev => {
          const next = prev === "circle-triangle" ? "pyramid" : "circle-triangle";
          setDrawProgress(0);
          setTimeout(() => setDrawProgress(1), 50);
          return next;
        });
      }, 5000);
    }, 1500);
    return () => {
      clearTimeout(delayTimer);
      if (timer) clearInterval(timer);
    };
  }, [autoPlay, isInView]);

  return (
    <div ref={containerRef} className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Workspace Vẽ Hình &bull; Mô Tả Bằng Lời Tạo Hình Vẽ
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Nhập đề bài hình học, hệ thống tự động suy luận tọa độ và vẽ hình chuẩn mực cho đề thi.
          </p>
        </div>

        <button
          onClick={onExplore}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-500/20 transition-all cursor-pointer hover:scale-105"
        >
          <span>Mở Workspace Vẽ</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switchers - Segmented Control chuẩn Animate-UI */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Mẫu hình vẽ:</span>
          
          <div className="flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 relative">
            <button
              type="button"
              onClick={() => {
                setShapeMode("circle-triangle");
                reanimate();
              }}
              className={"relative flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer z-10 " +
                (shapeMode === "circle-triangle" ? "text-sky-700" : "text-slate-600 hover:text-slate-900")
              }
            >
              {shapeMode === "circle-triangle" && (
                <motion.span
                  layoutId="geometry-shape-pill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span>Tam giác nội tiếp đường tròn</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShapeMode("pyramid");
                reanimate();
              }}
              className={"relative flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer z-10 " +
                (shapeMode === "pyramid" ? "text-sky-700" : "text-slate-600 hover:text-slate-900")
              }
            >
              {shapeMode === "pyramid" && (
                <motion.span
                  layoutId="geometry-shape-pill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span>Chóp tam giác S.ABC</span>
            </button>
          </div>
        </div>

        {/* Nút Auto / Vẽ lại kiểu Animate-UI nhỏ gọn có icon xoay */}
        <button
          type="button"
          onClick={() => {
            setAutoPlay(!autoPlay);
            if (!autoPlay) reanimate();
          }}
          className="text-xs font-bold text-slate-400 hover:text-sky-600 flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50 transition-all select-none"
          title="Bật / tắt tự động lặp lại mô phỏng"
        >
          <RefreshCw className={"w-3 h-3 " + (autoPlay && isInView ? "animate-spin text-sky-600" : "")} />
          <span>{autoPlay ? "Auto" : "Dừng"}</span>
        </button>
      </div>

      {/* Main Grid: Description + Interactive SVG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
        {/* Left: Prompt & Entity detection (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-2">Câu lệnh mô tả hình học:</span>
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3.5 text-xs text-slate-800 leading-relaxed font-sans mb-4">
              {shapeMode === "circle-triangle" ? (
                <>
                  <p className="font-semibold text-slate-900">
                    "Cho tam giác nhọn ABC nội tiếp đường tròn tâm O bán kính R. Kẻ đường cao AH vuông góc với BC."
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-900">
                    "Cho hình chóp S.ABC có đáy là tam giác vuông tại B, cạnh bên SA vuông góc với mặt phẳng đáy (ABC)."
                  </p>
                </>
              )}
            </div>

            <span className="text-xs font-bold text-slate-500 block mb-2">Thực thể đã nhận diện:</span>
            <div className="flex flex-wrap gap-1.5">
              {shapeMode === "circle-triangle" ? (
                <>
                  <span className="px-2 py-1 rounded-md bg-sky-100 text-sky-800 text-[11px] font-bold">Đường tròn (O)</span>
                  <span className="px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">Tam giác ABC</span>
                  <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">Đường cao AH ⊥ BC</span>
                </>
              ) : (
                <>
                  <span className="px-2 py-1 rounded-md bg-sky-100 text-sky-800 text-[11px] font-bold">Đỉnh S</span>
                  <span className="px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">Đáy ABC vuông tại B</span>
                  <span className="px-2 py-1 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold">SA ⊥ (ABC)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Dynamic animated SVG canvas (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50/20 via-white to-white p-4 sm:p-5 flex items-center justify-center min-h-[240px] shadow-sm">
          {shapeMode === "circle-triangle" ? (
            <svg
              viewBox="0 0 320 220"
              className="w-full max-w-[320px] h-auto drop-shadow-sm select-none"
            >
              {/* Circle (O) */}
              <motion.circle
                cx="160"
                cy="115"
                r="80"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="502"
                initial={{ strokeDashoffset: 502 }}
                animate={{ strokeDashoffset: drawProgress ? 0 : 502 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />

              {/* Triangle ABC */}
              <motion.polygon
                points="160,35 90,165 235,145"
                fill="rgba(56, 189, 248, 0.05)"
                stroke="#4f46e5"
                strokeWidth="2.5"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 1.2, delay: 0.6, ease: "easeInOut" }}
              />

              {/* Altitude AH */}
              <motion.line
                x1="160"
                y1="35"
                x2="155"
                y2="157"
                stroke="#e11d48"
                strokeWidth="2"
                strokeDasharray="4 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 1.4 }}
              />

              {/* Right angle symbol at H */}
              <motion.path
                d="M 152 147 L 160 148 L 163 158"
                fill="none"
                stroke="#e11d48"
                strokeWidth="1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: drawProgress ? 1 : 0 }}
                transition={{ delay: 2.1 }}
              />

              {/* Center O */}
              <circle cx="160" cy="115" r="3" fill="#0284c7" />
              <text x="165" y="118" fontSize="11" fontWeight="bold" fill="#0284c7">O</text>

              {/* Vertices Labels */}
              <text x="156" y="26" fontSize="12" fontWeight="bold" fill="#1e1b4b">A</text>
              <text x="75" y="175" fontSize="12" fontWeight="bold" fill="#1e1b4b">B</text>
              <text x="242" y="152" fontSize="12" fontWeight="bold" fill="#1e1b4b">C</text>
              <text x="150" y="174" fontSize="11" fontWeight="bold" fill="#e11d48">H</text>
            </svg>
          ) : (
            <svg
              viewBox="0 0 320 220"
              className="w-full max-w-[320px] h-auto drop-shadow-sm select-none"
            >
              {/* Altitude SA (solid) */}
              <motion.line
                x1="80"
                y1="40"
                x2="80"
                y2="160"
                stroke="#e11d48"
                strokeWidth="2.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 0.8 }}
              />

              {/* Base edges */}
              {/* AB (hidden / dashed) */}
              <motion.line
                x1="80"
                y1="160"
                x2="170"
                y2="190"
                stroke="#475569"
                strokeWidth="2"
                strokeDasharray="4 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              />
              {/* AC */}
              <motion.line
                x1="80"
                y1="160"
                x2="250"
                y2="150"
                stroke="#475569"
                strokeWidth="2"
                strokeDasharray="4 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              />
              {/* BC */}
              <motion.line
                x1="170"
                y1="190"
                x2="250"
                y2="150"
                stroke="#475569"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.9 }}
              />

              {/* Slant edges SB, SC */}
              <motion.line
                x1="80"
                y1="40"
                x2="170"
                y2="190"
                stroke="#4338ca"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 1.1 }}
              />
              <motion.line
                x1="80"
                y1="40"
                x2="250"
                y2="150"
                stroke="#4338ca"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawProgress ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 1.3 }}
              />

              {/* Right angle at A */}
              <path d="M 80 148 L 92 148 L 92 160" fill="none" stroke="#e11d48" strokeWidth="1.5" />

              {/* Labels */}
              <text x="75" y="30" fontSize="12" fontWeight="bold" fill="#1e1b4b">S</text>
              <text x="64" y="168" fontSize="12" fontWeight="bold" fill="#1e1b4b">A</text>
              <text x="168" y="206" fontSize="12" fontWeight="bold" fill="#1e1b4b">B</text>
              <text x="256" y="155" fontSize="12" fontWeight="bold" fill="#1e1b4b">C</text>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   4. MARKITDOWN MINI-DEMO: Nạp đa định dạng file -> Markdown cấu trúc
   ========================================================================= */
const FILE_PRESETS = [
  {
    type: "pdf",
    label: "Tài liệu PDF",
    name: "Luan_van_Toan_hoc_2025.pdf",
    icon: FileText,
    color: "text-rose-500",
    bg: "bg-rose-50",
    markdown: `# Luận án Toán Ứng Dụng\n\n## 1. Tổng quan nghiên cứu\nNghiên cứu về hội tụ nghiệm của chuỗi Fourier trên không gian Hilbert.\n\n| Bước | Thuật toán | Độ chính xác |\n| :--- | :--- | :--- |\n| 01 | Gradient Descent | 94.2% |\n| 02 | Adam Optimizer | 99.1% |`,
  },
  {
    type: "docx",
    label: "Giáo án DOCX",
    name: "Giao_an_Hinh_khong_gian.docx",
    icon: FileType,
    color: "text-blue-500",
    bg: "bg-blue-50",
    markdown: `# Giáo Án Tiết 34: Mặt Cầu Ngoại Tiếp\n\n### Mục tiêu bài học:\n- Nắm vững định nghĩa trục đường tròn đáy.\n- Xác định tâm mặt cầu bằng phương pháp dựng trung trực.\n\n> **Công thức ghi nhớ:** $R = \\sqrt{R_d^2 + \\left(\\frac{h}{2}\\right)^2}$`,
  },
  {
    type: "video",
    label: "Bài giảng Video/Audio",
    name: "Video_Chuyen_de_Tich_phan.mp4",
    icon: Video,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    markdown: `# Tóm Tắt Bài Giảng Tích Phân Từng Phần\n\n- **00:00 - 05:20:** Đặt ẩn phụ $u$ và $dv$ theo thứ tự ưu tiên.\n- **05:21 - 12:40:** Công thức $\\int u\\,\\mathrm{d}v = uv - \\int v\\,\\mathrm{d}u$.\n- **12:41 - Kết thúc:** Bài tập áp dụng tích phân hàm lượng giác.`,
  },
];

export const MarkItDownMiniDemo: React.FC<{ onExplore: () => void }> = ({ onExplore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.25 });

  // Mặc định bắt đầu từ tệp 0 (Tài liệu PDF)
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const current = FILE_PRESETS[selectedFileIdx];

  // Reset về PDF (index 0) mỗi khi cuộn tới
  useEffect(() => {
    if (isInView) {
      setSelectedFileIdx(0);
    }
  }, [isInView]);

  // Auto chuyển đổi vòng lặp khi bật Auto và trong tầm nhìn (delay 1.5 giây sau khi cuộn tới)
  useEffect(() => {
    if (!autoPlay || !isInView) return;
    let timer: any;
    const delayTimer = setTimeout(() => {
      timer = setInterval(() => {
        setSelectedFileIdx(prev => (prev + 1) % FILE_PRESETS.length);
      }, 4000);
    }, 1500);
    return () => {
      clearTimeout(delayTimer);
      if (timer) clearInterval(timer);
    };
  }, [autoPlay, isInView]);

  const handleSelectFile = (idx: number) => {
    if (idx === selectedFileIdx) return;
    setIsConverting(true);
    setSelectedFileIdx(idx);
    setTimeout(() => setIsConverting(false), 250);
  };

  return (
    <div ref={containerRef} className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Nạp PDF, DOCX, Video &rarr; Markdown Cấu Trúc Đẹp Mắt
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Chuyển đổi mọi loại tài liệu học liệu sang Markdown hoàn chỉnh, bảng biểu và công thức toán sạch sẽ.
          </p>
        </div>

        <button
          onClick={onExplore}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer hover:scale-105"
        >
          <span>Mở MarkItDown AI</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Select file type - Segmented Control chuẩn Animate-UI */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Chọn tệp nguồn demo:</span>
          
          <div className="flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 relative">
            {FILE_PRESETS.map((f, idx) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.type}
                  type="button"
                  onClick={() => {
                    handleSelectFile(idx);
                    setAutoPlay(false);
                  }}
                  className={"relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer z-10 " +
                    (selectedFileIdx === idx ? "text-emerald-700" : "text-slate-600 hover:text-slate-900")
                  }
                >
                  {selectedFileIdx === idx && (
                    <motion.span
                      layoutId="markitdown-file-pill"
                      className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <Icon className="w-3.5 h-3.5" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nút Auto xoay chuẩn Animate-UI */}
        <button
          type="button"
          onClick={() => setAutoPlay(!autoPlay)}
          className="text-xs font-bold text-slate-400 hover:text-emerald-600 flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50 transition-all select-none"
          title="Tự động chuyển đổi các loại tệp mẫu"
        >
          <RefreshCw className={"w-3 h-3 " + (autoPlay ? "animate-spin text-emerald-600" : "")} />
          <span>{autoPlay ? "Auto" : "Dừng"}</span>
        </button>
      </div>

      {/* Conversion viewer - Cố định chiều cao min-h-[250px] tránh giật khung */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
        {/* Source file simulation */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 flex flex-col justify-between h-[250px] min-h-[250px] max-h-[250px]">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-2">Tệp nguồn tải lên:</span>
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 flex flex-col items-center justify-center text-center">
              <div className={"w-12 h-12 rounded-2xl flex items-center justify-center mb-3 " + current.bg + " " + current.color}>
                {React.createElement(current.icon, { className: "w-6 h-6" })}
              </div>
              <p className="font-bold text-slate-800 text-xs sm:text-sm">{current.name}</p>
              <span className="text-[11px] text-slate-400 mt-1">Kéo thả hoặc dán liên kết URL</span>
            </div>
          </div>
        </div>

        {/* Generated Markdown Preview */}
        <div className="lg:col-span-7 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/30 via-white to-slate-50 p-4 sm:p-5 relative overflow-hidden shadow-sm h-[250px] min-h-[250px] max-h-[250px] flex flex-col justify-between">
          {isConverting && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
            />
          )}

          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <FileCode2 className="w-3.5 h-3.5" />
                Markdown Output &bull; Chuẩn GFM
              </span>
              <CopyMorphButton textToCopy={current.markdown} />
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3 font-mono text-xs text-slate-800 leading-relaxed h-[155px] min-h-[155px] max-h-[155px] whitespace-pre-wrap overflow-y-auto shadow-inner">
              {current.markdown}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

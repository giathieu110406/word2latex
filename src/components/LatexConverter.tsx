import React, { useState, useRef } from "react";
import { Sparkles, ArrowRight, Loader2, HelpCircle, Folder, Paperclip } from "lucide-react";

interface LatexConverterProps {
  wordFont: string;
  setWordFont: (font: string) => void;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  hasUnclosedDollar: (text: string) => boolean;
  showAiCanvas: boolean;
  setShowAiCanvas: (show: boolean) => void;
  isProcessingCanvas: boolean;
  handleCallAiCanvas: (prompt?: string) => void;
  aiCanvasPrompt: string;
  setAiCanvasPrompt: (prompt: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  copyToWord: () => void;
  downloadAsWord: () => void;
  copyRawLaTeX: () => void;
  downloadAsPdf: () => void;
  overleafCode: string;
  processedHtml: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  triggerToast: (msg: string, success?: boolean) => void;
  handlePasteGeneric: (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    setter: (val: string) => void,
    bypassAutoProcess?: boolean,
  ) => void;
  handleClear: () => void;
  isPro?: boolean;
  saveLatexToDocs?: (type: "word" | "pdf") => Promise<void>;
  isSavingDoc?: boolean;
}

export const LatexConverter: React.FC<LatexConverterProps> = ({
  wordFont,
  setWordFont,
  inputText,
  setInputText,
  hasUnclosedDollar,
  showAiCanvas,
  setShowAiCanvas,
  isProcessingCanvas,
  handleCallAiCanvas,
  aiCanvasPrompt,
  setAiCanvasPrompt,
  activeTab,
  setActiveTab,
  copyToWord,
  downloadAsWord,
  copyRawLaTeX,
  downloadAsPdf,
  overleafCode,
  processedHtml,
  previewRef,
  textareaRef,
  triggerToast,
  handlePasteGeneric,
  handleClear,
  isPro = false,
  saveLatexToDocs,
  isSavingDoc = false,
}) => {
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      triggerToast("Vui lòng chọn hoặc dán file hình ảnh!", false);
      return;
    }
    
    setIsExtractingText(true);
    triggerToast("Đang trích xuất văn bản từ hình ảnh...", true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = (reader.result as string).split(',')[1];
      try {
        const res = await fetch("/api/ai?action=extract-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image, mimeType: file.type }),
        });
        
        if (!res.ok) {
          throw new Error("Lỗi máy chủ khi trích xuất");
        }

        const data = await res.json();
        if (data.success && data.text) {
          setAiCanvasPrompt(aiCanvasPrompt + (aiCanvasPrompt ? "\n" : "") + data.text);
          triggerToast("Trích xuất văn bản thành công!", true);
        } else {
          triggerToast(data.error || "Không thể trích xuất văn bản từ hình ảnh này", false);
        }
      } catch (err: any) {
        console.error("Lỗi trích xuất văn bản:", err);
        triggerToast("Lỗi khi kết nối đến dịch vụ trích xuất văn bản!", false);
      } finally {
        setIsExtractingText(false);
      }
    };
    reader.onerror = () => {
      triggerToast("Không thể đọc file hình ảnh!", false);
      setIsExtractingText(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await extractTextFromImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        hasImage = true;
        break;
      }
    }

    if (hasImage) {
      e.preventDefault(); // Chặn hoàn toàn hành vi dán văn bản mặc định để tránh dán thừa câu hỏi hoặc text cũ
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            await extractTextFromImage(file);
          }
        }
      }
    }
  };

  return (
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] overflow-hidden flex flex-col flex-1 min-h-0 md:h-[calc(100vh-110px)] md:max-h-[calc(100vh-110px)]">
      {/* Top Control Settings Panel */}
      <div className="bg-white px-4 py-4 md:px-6 md:py-5 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
        <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 rounded-xl border border-indigo-100/50">
              <img
                src="/logo.svg"
                alt="Logo"
                className="w-5 h-5 rounded-md object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
                LaTeX2Word Converter
              </span>
              <span className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5 hidden xs:inline">
                BIÊN DỊCH CÔNG THỨC TOÁN HỌC
              </span>
            </div>
          </div>

          <span className="text-slate-250 hidden md:inline h-6 w-[1px] bg-slate-200" />

          {/* Font Styling Tools */}
          <div className="flex items-center gap-1.5 bg-white/40 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                // Emulate bold formatting
                const start = textareaRef.current?.selectionStart || 0;
                const end = textareaRef.current?.selectionEnd || 0;
                if (start !== end) {
                  const text = inputText;
                  const before = text.substring(0, start);
                  const selected = text.substring(start, end);
                  const after = text.substring(end);
                  setInputText(`${before}**${selected}**${after}`);
                }
              }}
              className="w-8 h-8 flex items-center justify-center font-extrabold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-800 transition-all cursor-pointer text-xs shadow-3xs active:scale-95"
              title="In đậm văn bản đang chọn (**)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => {
                // Emulate italic formatting
                const start = textareaRef.current?.selectionStart || 0;
                const end = textareaRef.current?.selectionEnd || 0;
                if (start !== end) {
                  const text = inputText;
                  const before = text.substring(0, start);
                  const selected = text.substring(start, end);
                  const after = text.substring(end);
                  setInputText(`${before}*${selected}*${after}`);
                }
              }}
              className="w-8 h-8 flex items-center justify-center italic font-bold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-800 transition-all cursor-pointer text-xs shadow-3xs active:scale-95"
              title="In nghiêng văn bản đang chọn (*)"
            >
              I
            </button>
          </div>
        </div>

        {/* Font selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            <span className="hidden xs:inline">Phông chữ Word:</span>
            <span className="xs:hidden">Phông:</span>
          </span>
          <div className="relative">
            <select
              value={wordFont}
              onChange={(e) => setWordFont(e.target.value)}
              className="appearance-none bg-white/40 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 py-2 pl-3 pr-8 cursor-pointer outline-none transition-all shadow-3xs"
            >
              <option value="'Times New Roman', Times, serif">
                Times New Roman (Chuẩn Quốc gia)
              </option>
              <option value="'Inter', 'Segoe UI', Arial, sans-serif">
                Inter (Phông mặc định Gemini)
              </option>
              <option value="'Arial', sans-serif">
                Arial
              </option>
              <option value="'Calibri', sans-serif">
                Calibri
              </option>
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace with inner padding and subtle background */}
      <div className="p-4 md:p-6 bg-white/30 flex-1 flex flex-col min-h-0">
        {/* Mobile View Selector */}
        <div className="lg:hidden flex bg-slate-100 p-1 rounded-xl mb-4 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setMobileView("edit")}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
              mobileView === "edit"
                ? "bg-white text-indigo-700 shadow-3xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Biên soạn nguồn
          </button>
          <button
            type="button"
            onClick={() => setMobileView("preview")}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
              mobileView === "preview"
                ? "bg-white text-indigo-700 shadow-3xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Xem kết quả dịch
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 flex-1 min-h-0 p-4 md:p-5 lg:p-6">
          {/* Left panel: Input Area */}
          <div className={`flex flex-col bg-white/50 rounded-2xl shadow-sm border border-white/50 overflow-hidden lg:h-full lg:max-h-full lg:min-h-0 min-h-0 flex-1 w-full transition-all ${mobileView === "edit" ? "flex" : "hidden lg:flex"}`}>
            <div className="bg-white/40 px-4 py-3 md:px-5 md:py-4 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between sm:items-center gap-4 select-none">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span className="text-xs md:text-sm font-bold text-slate-800 whitespace-nowrap">
                  <span className="hidden xs:inline">Nguồn tài liệu cần chuyển đổi</span>
                  <span className="xs:hidden">Tài liệu nguồn</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-start sm:justify-end mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={() => setShowAiCanvas(!showAiCanvas)}
                  className={`text-xs font-bold flex items-center justify-center gap-1.5 px-3 py-2 h-9 rounded-xl transition-all cursor-pointer shadow-3xs group relative overflow-hidden whitespace-nowrap ${
                    showAiCanvas
                      ? "bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-700"
                      : "text-indigo-700 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 hover:border-indigo-200"
                  }`}
                  title="Gọi Trợ lý AI Canvas để sửa đổi, giải chi tiết, dịch thuật"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${showAiCanvas ? "text-white animate-pulse" : "text-indigo-500 group-hover:text-indigo-600 group-hover:animate-pulse"}`} />
                  <span>
                    <span className="hidden xs:inline">Trợ lý AI Canvas</span>
                    <span className="xs:hidden">Trợ lý AI</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:border-rose-250 font-bold flex items-center justify-center px-3.5 py-2 h-9 hover:bg-rose-100 rounded-xl transition-all cursor-pointer shadow-3xs whitespace-nowrap"
                >
                  Xóa sạch
                </button>
              </div>
            </div>

            {hasUnclosedDollar(inputText) && (
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium select-none animate-fade-in">
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span>
                    <strong>Cảnh báo công thức:</strong> Số lượng ký tự Đô-la ($) bị lẻ (chưa đóng công thức). Có thể gây lỗi hiển thị LaTeX.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev.trim() + " $");
                    triggerToast(
                      "Đã tự động thêm ký tự $ ở cuối để hoàn tất đóng công thức!",
                      true,
                    );
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-sm self-end sm:self-auto"
                >
                  Sửa nhanh (Thêm $)
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              id="input-text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={(e) => handlePasteGeneric(e, setInputText)}
              disabled={isProcessingCanvas}
              className={`flex-1 min-h-0 w-full p-4 md:p-5 resize-none overflow-y-auto border-0 focus:ring-0 focus:outline-none text-slate-800 leading-relaxed text-sm md:text-base font-normal placeholder:text-slate-400 bg-white ${isProcessingCanvas ? "opacity-50 cursor-not-allowed" : "opacity-100"} transition-opacity duration-300`}
              placeholder="Nhập hoặc sao chép nội dung chứa công thức toán ($x^2$ hoặc $$y = mx+b$$) từ AI hay tài liệu bất kỳ và dán vào đây để chuyển hóa..."
            />

            {/* AI Canvas Panel */}
            {showAiCanvas && (
              <div className="border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm p-4 pb-8 md:pb-4 shrink-0 flex flex-col gap-3 animate-fade-in overflow-y-auto max-h-[50%] z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] relative">
                <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs md:text-sm select-none">
                  <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                  <span>Trợ lý AI Canvas</span>
                </div>
                
                {/* Preset quick action tags */}
                <div className="flex flex-wrap gap-1.5 select-none">
                  {[
                    { label: "Dịch sang tiếng Anh", prompt: "Dịch toàn bộ văn bản sang tiếng Anh, giữ nguyên các công thức LaTeX dạng $...$ hoặc $$...$$." },
                    { label: "Thêm lời giải chi tiết", prompt: "Hãy bổ sung lời giải thích chi tiết từng bước cho các công thức, các bài tập trong văn bản này." },
                    { label: "In đậm từ khóa", prompt: "Hãy tìm các thuật ngữ chuyên ngành, định lý, định luật hoặc từ khóa chính trong văn bản và in đậm chúng bằng dấu **." },
                    { label: "Tạo câu hỏi tương tự", prompt: "Dựa trên nội dung hiện tại, hãy tạo thêm một câu hỏi toán học/bài tập tương tự đi kèm đáp án và lời giải chi tiết." }
                  ].map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={() => handleCallAiCanvas(tag.prompt)}
                      disabled={isProcessingCanvas}
                      className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-750 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-3xs hover:shadow-2xs active:scale-95 disabled:opacity-50"
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>

                {/* Prompt Input Box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCallAiCanvas();
                  }}
                  className="relative flex items-center bg-white border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100/50 rounded-xl transition-all shadow-3xs"
                >
                  <input
                    type="text"
                    value={aiCanvasPrompt}
                    onChange={(e) => setAiCanvasPrompt(e.target.value)}
                    onPaste={handlePaste}
                    disabled={isProcessingCanvas || isExtractingText}
                    placeholder={isExtractingText ? "Đang trích xuất văn bản từ hình ảnh..." : "Yêu cầu AI chỉnh sửa văn bản này (vd: 'Tìm lỗi sai', 'Thêm ví dụ minh họa'...)"}
                    className="w-full pl-4 pr-24 py-2.5 text-xs md:text-sm bg-transparent outline-none border-none text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  <div className="absolute right-12 flex items-center gap-1">
                    <button 
                      type="button" 
                      disabled={isExtractingText || isProcessingCanvas}
                      onClick={() => fileInputRef.current?.click()} 
                      className="text-slate-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors"
                      title="Tải ảnh lên"
                    >
                      {isExtractingText ? (
                        <span className="w-4 h-4 block border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <Paperclip className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isProcessingCanvas || isExtractingText || !aiCanvasPrompt.trim()}
                    className="absolute right-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-xs active:scale-95"
                  >
                    {isProcessingCanvas ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </button>
                </form>
              </div>
            )}

            <div className="px-4 py-3 bg-white/40 border-t border-slate-200/80 text-[11px] text-slate-500 font-bold flex justify-between items-center select-none">
              <span>
                Độ dài ký tự: <strong className="text-slate-800 font-extrabold">{inputText.length}</strong>
              </span>
              <span className="italic text-slate-400 font-medium">
                Canvas đồng bộ trực tiếp khi sửa đổi
              </span>
            </div>
          </div>

          {/* Right panel: Preview & Advanced Copy Area */}
          <div className={`flex flex-col bg-white/50 rounded-2xl shadow-sm border border-white/50 overflow-hidden lg:h-full lg:max-h-full lg:min-h-0 min-h-[450px] flex-1 w-full transition-all ${mobileView === "preview" ? "flex" : "hidden lg:flex"}`}>
            {/* Header with Switch output tabs */}
            <div className="bg-white/40 px-4 py-3 md:px-5 md:py-4 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between sm:items-center gap-4 select-none">
              {/* Left Group: Tab selector with visual divider */}
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex bg-slate-200/60 p-1 rounded-xl text-xs font-bold gap-1 w-full sm:w-auto flex-1 sm:flex-none">
                  <button
                    type="button"
                    onClick={() => setActiveTab("word")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer text-center ${
                      activeTab === "word"
                        ? "bg-white text-slate-950 shadow-3xs font-extrabold"
                        : "text-slate-600 hover:text-slate-900 font-bold"
                    }`}
                  >
                    Xem trước
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("latex")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer text-center ${
                      activeTab === "latex"
                        ? "bg-white text-slate-950 shadow-3xs font-extrabold"
                        : "text-slate-600 hover:text-slate-900 font-bold"
                    }`}
                  >
                    Tải PDF
                  </button>
                </div>
                <div className="hidden sm:block h-6 w-[1px] bg-slate-300/80" />
              </div>

              {/* Dynamic copy and download actions with responsive texts */}
              <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-stretch sm:justify-end mt-2 sm:mt-0">
                {activeTab === "word" ? (
                  <>
                    <button
                      type="button"
                      onClick={copyToWord}
                      className="bg-slate-700 hover:bg-slate-800 text-white h-9 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer flex-1 sm:flex-none flex items-center justify-center whitespace-nowrap active:scale-95"
                    >
                      <span>Sao chép</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadAsWord}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer flex-1 sm:flex-none flex items-center justify-center whitespace-nowrap active:scale-95"
                      title="Tải file Word (.doc) hỗ trợ MathML đầy đủ"
                    >
                      <span className="hidden xs:inline">Tải Word</span>
                      <span className="xs:hidden">Word</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={copyRawLaTeX}
                      className="bg-slate-700 hover:bg-slate-800 text-white h-9 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer flex-1 sm:flex-none flex items-center justify-center whitespace-nowrap active:scale-95"
                    >
                      <span>Sao chép</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadAsPdf}
                      disabled={!overleafCode}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer flex-1 sm:flex-none flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap active:scale-95"
                      title="Tải PDF trực tiếp về máy"
                    >
                      <span className="hidden xs:inline">Tải PDF</span>
                      <span className="xs:hidden">PDF</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Display Viewports */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-white/40/10">
              {/* Word preview editor body */}
              <div
                ref={previewRef}
                style={{
                  fontFamily: wordFont,
                }}
                onCopy={(e) => {
                  e.preventDefault();
                }}
                onCut={(e) => {
                  e.preventDefault();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                }}
                onKeyDown={(e) => {
                  if (
                    (e.ctrlKey || e.metaKey) &&
                    (e.key === "c" ||
                      e.key === "x" ||
                      e.key === "C" ||
                      e.key === "X")
                  ) {
                    e.preventDefault();
                  }
                }}
                onDragStart={(e) => {
                  e.preventDefault();
                }}
                className={`preview-content flex-1 w-full p-5 md:p-6 overflow-auto leading-relaxed text-sm md:text-base text-slate-850 select-none bg-white rounded-b-2xl border-0 ${
                  activeTab === "word" ? "block" : "hidden"
                }`}
                dangerouslySetInnerHTML={{ __html: processedHtml }}
              />

              {/* Download LaTeX File view block */}
              <div
                className={`flex-1 w-full p-5 md:p-6 bg-white/30 overflow-auto rounded-b-2xl ${
                  activeTab === "latex" ? "block" : "hidden"
                }`}
              >
                <div className="max-w-md mx-auto w-full bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm flex flex-col items-center text-center gap-5 mt-2 md:mt-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                    </svg>
                  </div>
                  <div className="space-y-1.5 select-none">
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Tài liệu PDF & LaTeX</h3>
                    <p className="text-xs text-emerald-600 font-mono select-all font-bold tracking-tight bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">tai_lieu.pdf</p>
                  </div>

                  <div className="w-full flex flex-col gap-2.5">
                    {/* Nút Tải PDF */}
                    <button
                      type="button"
                      onClick={downloadAsPdf}
                      disabled={!overleafCode}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs md:text-sm transition-all shadow-md cursor-pointer ${
                        overleafCode
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10 active:scale-[0.98]"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                      title="Tải PDF trực tiếp về máy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                      </svg>
                      <span>Tải xuống</span>
                    </button>

                    <button
                      type="button"
                      onClick={copyRawLaTeX}
                      disabled={!overleafCode}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                        overleafCode
                          ? "bg-white text-slate-700 border-slate-200 hover:bg-white/40 hover:text-slate-950 active:scale-[0.98] shadow-3xs"
                          : "bg-white/40 text-slate-300 border-slate-150 cursor-not-allowed"
                      }`}
                    >
                      <span>Sao chép</span>
                    </button>
                  </div>

                  {/* Ghi chú hướng dẫn */}
                  <p className="text-[11px] text-slate-400 text-center leading-relaxed mt-1 select-none font-medium">
                    💡 <strong>Ghi chú:</strong> Hệ thống đã cấu hình mã nguồn LaTeX hỗ trợ đầy đủ tiếng Việt và gói biên soạn chuyên nghiệp.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
 
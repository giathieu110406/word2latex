
import { authFetch } from "../utils/api-client";
import { getActivePlan, getPlanLimits } from "../../shared/subscription-policy";
import React, { useState, useRef, useEffect } from "react";
import { Sparkles, ArrowRight, Loader2, Paperclip, Code2, Eye, ChevronDown, Check, Type } from "lucide-react";
import { motion } from "motion/react";

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
  userDoc?: any;
  isPro?: boolean;
  currentMultiplier?: number;
  onRequireAuth?: () => boolean;
  incrementPromptCount?: () => Promise<void>;
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
  userDoc,
  isPro,
  currentMultiplier = 1,
  onRequireAuth,
  incrementPromptCount,
}) => {
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState<boolean>(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);

  // Close font dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setIsFontDropdownOpen(false);
      }
    };
    if (isFontDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFontDropdownOpen]);

  const fontOptions = [
    {
      value: "'Times New Roman', Times, serif",
      label: "Times New Roman (Chuẩn Quốc gia)",
      shortLabel: "Times New Roman",
      fontFamily: "'Times New Roman', Times, serif",
    },
    {
      value: "'Inter', 'Segoe UI', Arial, sans-serif",
      label: "Inter (Phông mặc định Gemini)",
      shortLabel: "Inter",
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    },
    {
      value: "'Arial', sans-serif",
      label: "Arial",
      shortLabel: "Arial",
      fontFamily: "'Arial', sans-serif",
    },
    {
      value: "'Calibri', sans-serif",
      label: "Calibri",
      shortLabel: "Calibri",
      fontFamily: "'Calibri', sans-serif",
    },
  ];

  const currentFontOption = fontOptions.find(f => f.value === wordFont) || fontOptions[0];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSyncingScroll = useRef<boolean>(false);
  const lastSyncSource = useRef<'left' | 'right' | null>(null);

  // Synchronized scrolling between textarea and preview panel
  useEffect(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    let timeoutId: any = null;

    const handleLeftScroll = () => {
      if (isSyncingScroll.current && lastSyncSource.current === 'right') return;
      isSyncingScroll.current = true;
      lastSyncSource.current = 'left';
      clearTimeout(timeoutId);

      const maxScrollLeft = textarea.scrollHeight - textarea.clientHeight;
      const ratio = maxScrollLeft > 0 ? textarea.scrollTop / maxScrollLeft : 0;
      const maxScrollRight = preview.scrollHeight - preview.clientHeight;
      preview.scrollTop = ratio * maxScrollRight;

      timeoutId = setTimeout(() => {
        isSyncingScroll.current = false;
        lastSyncSource.current = null;
      }, 50);
    };

    const handleRightScroll = () => {
      if (isSyncingScroll.current && lastSyncSource.current === 'left') return;
      isSyncingScroll.current = true;
      lastSyncSource.current = 'right';
      clearTimeout(timeoutId);

      const maxScrollRight = preview.scrollHeight - preview.clientHeight;
      const ratio = maxScrollRight > 0 ? preview.scrollTop / maxScrollRight : 0;
      const maxScrollLeft = textarea.scrollHeight - textarea.clientHeight;
      textarea.scrollTop = ratio * maxScrollLeft;

      timeoutId = setTimeout(() => {
        isSyncingScroll.current = false;
        lastSyncSource.current = null;
      }, 50);
    };

    textarea.addEventListener('scroll', handleLeftScroll, { passive: true });
    preview.addEventListener('scroll', handleRightScroll, { passive: true });

    return () => {
      textarea.removeEventListener('scroll', handleLeftScroll);
      preview.removeEventListener('scroll', handleRightScroll);
      clearTimeout(timeoutId);
    };
  }, [textareaRef, previewRef, activeTab]);

  // Synchronized text selection from left (input) to right (preview)
  const syncSelectionToPreview = () => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview || activeTab !== 'word') return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = window.getSelection();

    if (start === end || !selection) {
      if (selection && selection.rangeCount > 0) {
        for (let i = 0; i < selection.rangeCount; i++) {
          const range = selection.getRangeAt(i);
          if (preview.contains(range.commonAncestorContainer)) {
            selection.removeAllRanges();
            break;
          }
        }
      }
      return;
    }

    const selectedRawText = textarea.value.substring(start, end).trim();
    if (!selectedRawText) return;

    const searchTarget = selectedRawText
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/[\$\^\_\{\}\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const textToFind = searchTarget.length >= 2 ? searchTarget : selectedRawText;

    try {
      const walker = document.createTreeWalker(
        preview,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node: Node | null;
      let matchedNode: Node | null = null;
      let matchOffset = -1;

      while ((node = walker.nextNode())) {
        const textContent = node.nodeValue || '';
        const idx = textContent.toLowerCase().indexOf(textToFind.toLowerCase());
        if (idx !== -1) {
          matchedNode = node;
          matchOffset = idx;
          break;
        }
      }

      if (!matchedNode && textToFind.length > 5) {
        const partial = textToFind.substring(0, Math.min(textToFind.length, 15)).trim();
        const walkerPartial = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null);
        while ((node = walkerPartial.nextNode())) {
          const textContent = node.nodeValue || '';
          const idx = textContent.toLowerCase().indexOf(partial.toLowerCase());
          if (idx !== -1) {
            matchedNode = node;
            matchOffset = idx;
            break;
          }
        }
      }

      if (matchedNode) {
        const range = document.createRange();
        const matchedLen = Math.min(
          textToFind.length,
          (matchedNode.nodeValue?.length || 0) - matchOffset
        );
        range.setStart(matchedNode, matchOffset);
        range.setEnd(matchedNode, matchOffset + Math.max(1, matchedLen));

        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (err) {
      // Ignore DOM selection calculation errors
    }
  };

  const extractDocumentFile = async (file: File) => {
    const isImg = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);

    // Nếu là hình ảnh OCR (sử dụng Gemini AI), kiểm tra đăng nhập & hạn mức AI trong ngày
    if (isImg) {
      if (onRequireAuth && !onRequireAuth()) return;

      const currentPromptCount = userDoc?.promptCount || 0;
      const userPlan = getActivePlan(userDoc?.planType, userDoc?.planExpiresAt);
      const aiLimit = getPlanLimits(userPlan).ai;
      if (!isPro && currentPromptCount >= aiLimit) {
        triggerToast(
          `Bạn đã đạt giới hạn nhận diện ảnh bằng AI hôm nay (tối đa ${aiLimit} lượt/ngày). Vui lòng nâng cấp gói Pro để không giới hạn!`,
          false
        );
        return;
      }
    }

    setIsExtractingText(true);
    triggerToast(isImg ? `Đang nhận diện hình ảnh "${file.name}" sang LaTeX...` : `Đang trích xuất văn bản từ tệp "${file.name}"...`, true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      try {
        let res: Response;
        let data: any;

        if (isImg) {
          // Với hình ảnh, gửi trực tiếp sang AI Math Polish để nhận diện OCR công thức toán học và bảng biểu
          res = await authFetch("/api/markitdown", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "file",
              fileData: base64Data,
              fileName: file.name,
              mimeType: file.type || "image/png",
              mode: "ai",
            }),
          });
          data = await res.json();
        } else {
          // Với tài liệu (Word, PDF text...), ưu tiên AnyDoc Fast Mode
          res = await authFetch("/api/markitdown", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "file",
              fileData: base64Data,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              mode: "fast",
            }),
          });
          data = await res.json();

          // Fallback sang AI nếu fast mode không đọc được
          if (!res.ok || !data.success) {
            res = await authFetch("/api/markitdown", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "file",
                fileData: base64Data,
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
                mode: "ai",
              }),
            });
            data = await res.json();
          }
        }

        const extractedText = data.markdown || data.text;
        if (data.success && extractedText) {
          setInputText((prev) => (prev.trim() ? prev + "\n\n" + extractedText : extractedText));
          if (isImg && incrementPromptCount) {
            await incrementPromptCount();
          }
          triggerToast(isImg ? "Đã nhận diện hình ảnh thành công!" : "Trích xuất văn bản Markdown thành công!", true);
        } else {
          triggerToast(data.error || "Không thể trích xuất nội dung từ tệp này", false);
        }
      } catch (err: any) {
        console.error("Lỗi trích xuất văn bản/hình ảnh:", err);
        triggerToast("Lỗi khi kết nối đến dịch vụ trích xuất!", false);
      } finally {
        setIsExtractingText(false);
      }
    };
    reader.onerror = () => {
      triggerToast("Không thể đọc tệp tin!", false);
      setIsExtractingText(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await extractDocumentFile(file);
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
            await extractDocumentFile(file);
          }
        }
      }
    }
  };

  const handleMainTextAreaPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        hasImage = true;
        break;
      }
    }

    if (hasImage) {
      e.preventDefault();
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            await extractDocumentFile(file);
          }
        }
      }
    } else {
      handlePasteGeneric(e, setInputText, true);
    }
  };

  return (
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] overflow-hidden flex flex-col w-full h-full min-h-0 flex-1">
      {/* Top Control Settings Panel */}
      <div id="tour-latex-font-controls" className="bg-white px-4 py-2 sm:py-2.5 md:px-5 md:py-2.5 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 select-none">
        <div className="flex items-center justify-between gap-3 md:gap-4 w-full sm:w-auto flex-1">
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

          {/* Font Styling Tools (Đưa qua sát góc bên phải) */}
          <div className="flex items-center gap-1.5 bg-white/40 p-1 rounded-xl border border-slate-200/60 ml-auto">
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

        {/* Custom Font Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end min-w-0 relative">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            <span className="hidden xs:inline">Phông chữ Word:</span>
            <span className="xs:hidden">Phông:</span>
          </span>
          <div ref={fontDropdownRef} className="relative min-w-0 flex-1 sm:flex-none w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsFontDropdownOpen(prev => !prev)}
              className="w-full sm:w-[260px] flex items-center justify-between gap-2 bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-indigo-300 text-slate-800 text-xs font-bold rounded-xl py-2 px-3 shadow-3xs hover:shadow-xs transition-all cursor-pointer group"
              title="Chọn phông chữ hiển thị khi xuất sang Word"
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <Type className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate" style={{ fontFamily: currentFontOption.fontFamily }}>
                  {currentFontOption.label}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform duration-200 ${
                  isFontDropdownOpen ? "rotate-180 text-indigo-600" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu Popover */}
            {isFontDropdownOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-full sm:w-[280px] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 p-1.5 animate-fade-in select-none">
                <div className="px-2.5 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                  Chọn phông xuất Word
                </div>
                <div className="flex flex-col gap-1">
                  {fontOptions.map((opt) => {
                    const isSelected = opt.value === wordFont;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setWordFont(opt.value);
                          setIsFontDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                          isSelected
                            ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-150 shadow-3xs"
                            : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span
                            className="text-xs truncate font-medium"
                            style={{ fontFamily: opt.fontFamily }}
                          >
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            Mẫu chữ: Aa Bb Cc 123
                          </span>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workspace with inner padding and subtle background */}
      <div className="p-1.5 sm:p-2.5 md:p-3 bg-white/30 flex-1 flex flex-col min-h-0">
        {/* Mobile View Selector */}
        <div className="lg:hidden flex bg-slate-100/90 p-1.5 rounded-2xl mb-3 shrink-0 select-none border border-slate-200/60 shadow-xs">
          <button
            type="button"
            onClick={() => setMobileView("edit")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mobileView === "edit"
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Biên soạn nguồn</span>
            {inputText.length > 0 && (
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                {inputText.length > 999 ? `${Math.round(inputText.length / 1000)}k` : inputText.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileView("preview")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mobileView === "preview"
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem kết quả</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-1 min-h-0 p-0 sm:p-2 lg:p-0">
          {/* Left panel: Input Area */}
          <div id="tour-latex-input-panel" className={`flex flex-col bg-white/50 rounded-2xl shadow-sm border border-white/50 overflow-hidden h-full max-h-full min-h-0 flex-1 w-full transition-all ${mobileView === "edit" ? "flex" : "hidden lg:flex"}`}>
            <div className="bg-white/40 px-4 py-3 md:px-5 md:py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-2 select-none min-h-[58px] sm:min-h-[62px]">
              <div className="flex items-center gap-2 shrink-0 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-xs md:text-sm font-bold text-slate-800 whitespace-nowrap truncate">
                  <span className="hidden xs:inline">Nguồn tài liệu cần chuyển đổi</span>
                  <span className="xs:hidden">Tài liệu nguồn</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="tour-latex-ai-canvas"
                  type="button"
                  onClick={() => setShowAiCanvas(!showAiCanvas)}
                  className={`text-xs font-bold flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 h-8 sm:h-9 rounded-xl transition-all cursor-pointer shadow-3xs group relative overflow-hidden whitespace-nowrap ${
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
                  className="text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:border-rose-250 font-bold flex items-center justify-center px-2.5 sm:px-3.5 py-1.5 sm:py-2 h-8 sm:h-9 hover:bg-rose-100 rounded-xl transition-all cursor-pointer shadow-3xs whitespace-nowrap"
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

            <div className="relative flex-1 min-h-0 flex flex-col">
              <textarea
                ref={textareaRef}
                id="input-text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handleMainTextAreaPaste}
                disabled={isProcessingCanvas}
                className={`flex-1 min-h-0 w-full p-3.5 sm:p-4 md:p-5 resize-none overflow-y-auto overscroll-contain border-0 focus:ring-0 focus:outline-none text-slate-800 leading-relaxed text-sm md:text-base font-normal bg-white ${isProcessingCanvas ? "opacity-50 cursor-not-allowed" : "opacity-100"} transition-opacity duration-300`}
              />
              {!inputText && (
                <div 
                  onClick={() => textareaRef.current?.focus()}
                  className="absolute inset-0 p-3.5 sm:p-4 md:p-5 pointer-events-none select-none text-slate-400 flex flex-col justify-start"
                >
                  <p className="text-base sm:text-lg font-bold text-slate-400/90 leading-snug mb-2">
                    Dán trực tiếp văn bản hoặc hình ảnh chứa công thức (Ctrl+V) vào đây
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400/70 font-normal leading-relaxed">
                    Dùng AI canvas để dán ảnh chụp màn hình công thức, tải lên tài liệu Word/PDF để trích xuất, hoặc nhập công thức LaTeX ($x^2$ hoặc $$y = mx+b$$) để chuyển sang Word ...
                  </p>
                </div>
              )}
            </div>

            {/* AI Canvas Panel */}
            {showAiCanvas && (
              <div className="border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm p-3 sm:p-3.5 shrink-0 animate-fade-in z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] relative">
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
                    placeholder={isExtractingText ? "Đang trích xuất văn bản từ tệp tin..." : "Yêu cầu AI chỉnh sửa văn bản này (vd: 'Tìm lỗi sai', 'Thêm ví dụ minh họa'...)"}
                    className="w-full pl-4 pr-24 py-2.5 text-xs md:text-sm bg-transparent outline-none border-none text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp,.rtf,.epub,.txt,.md,.markdown,.csv,.json,.xml,.html,image/*" 
                    onChange={handleFileChange} 
                  />
                  <div className="absolute right-12 flex items-center gap-1">
                    <button 
                      type="button" 
                      disabled={isExtractingText || isProcessingCanvas}
                      onClick={() => fileInputRef.current?.click()} 
                      className="text-slate-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors"
                      title="Tải tệp hoặc hình ảnh lên để trích xuất Markdown"
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
          <div id="tour-latex-preview-panel" className={`flex flex-col bg-white/50 rounded-2xl shadow-sm border border-white/50 overflow-hidden h-full max-h-full min-h-0 flex-1 w-full transition-all ${mobileView === "preview" ? "flex" : "hidden lg:flex"}`}>
            {/* Header with Switch output tabs */}
            <div className="bg-white/40 px-4 py-3 md:px-5 md:py-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 select-none min-h-[58px] sm:min-h-[62px]">
              {/* Left Group: Tab selector with visual divider */}
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex bg-slate-200/60 p-1 rounded-xl text-xs font-bold gap-1 w-full sm:w-auto flex-1 sm:flex-none relative">
                  <button
                    type="button"
                    onClick={() => setActiveTab("word")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-colors cursor-pointer text-center relative z-10 ${
                      activeTab === "word"
                        ? "text-slate-950 font-extrabold"
                        : "text-slate-600 hover:text-slate-900 font-bold"
                    }`}
                  >
                    {activeTab === "word" && (
                      <motion.div
                        layoutId="active-latex-tab-pill"
                        className="absolute inset-0 bg-white rounded-lg shadow-3xs -z-10"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    Xem trước
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("latex")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-colors cursor-pointer text-center relative z-10 ${
                      activeTab === "latex"
                        ? "text-slate-950 font-extrabold"
                        : "text-slate-600 hover:text-slate-900 font-bold"
                    }`}
                  >
                    {activeTab === "latex" && (
                      <motion.div
                        layoutId="active-latex-tab-pill"
                        className="absolute inset-0 bg-white rounded-lg shadow-3xs -z-10"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    Tải PDF
                  </button>
                </div>
                <div className="hidden sm:block h-6 w-[1px] bg-slate-300/80" />
              </div>

              {/* Dynamic copy and download actions with responsive texts */}
              <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-stretch sm:justify-end">
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
                      title="Tải file Word (.docx) với công thức Equation chỉnh sửa được"
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
                className={`preview-content flex-1 w-full p-5 md:p-6 overflow-auto overscroll-contain leading-relaxed text-sm md:text-base text-slate-850 select-none bg-white rounded-b-2xl border-0 ${
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

import React from "react";
import { Sparkles, HelpCircle, FileEdit, Eye, ChevronDown, Check, Type } from "lucide-react";
import { motion } from "motion/react";

interface QBuilderProps {
  wordFont: string;
  setWordFont: (font: string) => void;
  docHeaderStyle: "centered" | "split";
  setDocHeaderStyle: (style: "centered" | "split") => void;
  docTitle: string;
  setDocTitle: (title: string) => void;
  docSubtitle: string;
  setDocSubtitle: (sub: string) => void;
  docStudentInfoFormat: string;
  setDocStudentInfoFormat: (info: string) => void;
  docTimeLimit: string;
  setDocTimeLimit: (time: string) => void;
  docExamCode: string;
  setDocExamCode: (code: string) => void;
  docSchoolName: string;
  setDocSchoolName: (school: string) => void;
  docExamName: string;
  setDocExamName: (exam: string) => void;
  docSubjectName: string;
  setDocSubjectName: (subject: string) => void;
  editingQuestionId: string | null;
  setEditingQuestionId: (id: string | null) => void;
  docQuestions: Array<{
    id: string;
    type: string;
    questionText: string;
    answerText?: string;
    columns?: number;
  }>;
  tracNghiemText: string;
  setTracNghiemText: (text: string) => void;
  tracNghiemAnswerText: string;
  setTracNghiemAnswerText: (text: string) => void;
  dungSaiText: string;
  setDungSaiText: (text: string) => void;
  dungSaiAnswerText: string;
  setDungSaiAnswerText: (text: string) => void;
  traLoiNganText: string;
  setTraLoiNganText: (text: string) => void;
  traLoiNganAnswerText: string;
  setTraLoiNganAnswerText: (text: string) => void;
  tuLuanQuestionText: string;
  setTuLuanQuestionText: (text: string) => void;
  tuLuanAnswerText: string;
  setTuLuanAnswerText: (text: string) => void;
  newQuestionType: "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan";
  setNewQuestionType: (type: "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan") => void;
  setShowSmartPasteModal: (show: boolean) => void;
  newTracNghiemColumns: number;
  setNewTracNghiemColumns: (cols: number) => void;
  handleAddQuestion: () => void;
  savedQuestionTab: string;
  setSavedQuestionTab: (tab: string) => void;
  tracNghiemList: any[];
  dungSaiList: any[];
  traLoiNganList: any[];
  tuLuanList: any[];
  handleStartEditQuestion: (q: any) => void;
  handleDeleteQuestion: (id: string) => void;
  handleMoveQuestion: (idx: number, direction: "up" | "down") => void;
  handleUpdateQuestionColumns: (id: string, cols: number) => void;
  downloadDocAsWord: () => void;
  setShowShuffleConfirm: (show: boolean) => void;
  showShuffleConfirm: boolean;
  isShuffling: boolean;
  isAIShuffleEnabled: boolean;
  setIsAIShuffleEnabled: (enabled: boolean) => void;
  handleShuffleExam: () => void;
  docPreviewRef: React.RefObject<HTMLDivElement | null>;
  labelTracNghiem: string;
  labelDungSai: string;
  labelTraLoiNgan: string;
  labelTuLuan: string;
  parseMultipleChoice: (text: string) => { questionBody: string; options: Array<{ label: string; text: string }> };
  getCleanQuestionBody: (text: string) => string;
  hasQuestionPrefix: (text: string) => boolean;
  renderContentWithMath: (text: string, promoteStandaloneMath?: boolean) => string;
  triggerToast: (msg: string, success?: boolean) => void;
  handlePasteGeneric: (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    setter: (val: string) => void,
    bypassAutoProcess?: boolean,
  ) => void;
}

export const QBuilder: React.FC<QBuilderProps> = ({
  wordFont,
  setWordFont,
  docHeaderStyle,
  setDocHeaderStyle,
  docTitle,
  setDocTitle,
  docSubtitle,
  setDocSubtitle,
  docStudentInfoFormat,
  setDocStudentInfoFormat,
  docTimeLimit,
  setDocTimeLimit,
  docExamCode,
  setDocExamCode,
  docSchoolName,
  setDocSchoolName,
  docExamName,
  setDocExamName,
  docSubjectName,
  setDocSubjectName,
  editingQuestionId,
  setEditingQuestionId,
  docQuestions,
  tracNghiemText,
  setTracNghiemText,
  tracNghiemAnswerText,
  setTracNghiemAnswerText,
  dungSaiText,
  setDungSaiText,
  dungSaiAnswerText,
  setDungSaiAnswerText,
  traLoiNganText,
  setTraLoiNganText,
  traLoiNganAnswerText,
  setTraLoiNganAnswerText,
  tuLuanQuestionText,
  setTuLuanQuestionText,
  tuLuanAnswerText,
  setTuLuanAnswerText,
  newQuestionType,
  setNewQuestionType,
  setShowSmartPasteModal,
  newTracNghiemColumns,
  setNewTracNghiemColumns,
  handleAddQuestion,
  savedQuestionTab,
  setSavedQuestionTab,
  tracNghiemList,
  dungSaiList,
  traLoiNganList,
  tuLuanList,
  handleStartEditQuestion,
  handleDeleteQuestion,
  handleMoveQuestion,
  handleUpdateQuestionColumns,
  downloadDocAsWord,
  setShowShuffleConfirm,
  showShuffleConfirm,
  isShuffling,
  isAIShuffleEnabled,
  setIsAIShuffleEnabled,
  handleShuffleExam,
  docPreviewRef,
  labelTracNghiem,
  labelDungSai,
  labelTraLoiNgan,
  labelTuLuan,
  parseMultipleChoice,
  getCleanQuestionBody,
  hasQuestionPrefix,
  renderContentWithMath,
  triggerToast,
  handlePasteGeneric,
}) => {
  const [isHeaderOpen, setIsHeaderOpen] = React.useState(false);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = React.useState<boolean>(false);
  const fontDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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
      fontFamily: "'Times New Roman', Times, serif",
    },
    {
      value: "'Inter', 'Segoe UI', Arial, sans-serif",
      label: "Inter (Phông mặc định Gemini)",
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    },
    {
      value: "'Arial', sans-serif",
      label: "Arial",
      fontFamily: "'Arial', sans-serif",
    },
    {
      value: "'Calibri', sans-serif",
      label: "Calibri",
      fontFamily: "'Calibri', sans-serif",
    },
  ];

  const currentFontOption = fontOptions.find(f => f.value === wordFont) || fontOptions[0];
  const [mobileView, setMobileView] = React.useState<"edit" | "preview">("edit");

  // Đồng bộ chiều cao cột Xem trước theo chiều cao thực tế của cột Soạn thảo
  const leftPanelRef = React.useRef<HTMLDivElement>(null);
  const [leftPanelHeight, setLeftPanelHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    const updateHeight = () => {
      if (leftPanelRef.current) {
        const height = leftPanelRef.current.offsetHeight;
        if (height > 0) {
          setLeftPanelHeight(height);
        }
      }
    };

    updateHeight();

    if (!leftPanelRef.current) return;
    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(leftPanelRef.current);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);
  
  return (
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] overflow-hidden flex flex-col w-full h-auto shrink-0">
      {/* Top Control Settings Panel */}
      <div className="bg-white px-4 py-2 sm:py-2.5 md:px-5 md:py-2.5 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 select-none min-h-[52px] sm:min-h-[58px]">
        <div className="flex items-center justify-between gap-3 md:gap-4 w-full sm:w-auto">
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
                Q-Builder
              </span>
              <span className="text-[10px] text-emerald-600 font-black tracking-wider mt-0.5 uppercase hidden xs:inline">
                CÔNG CỤ BIÊN SOẠN ĐỀ THI THÔNG MINH
              </span>
            </div>
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
      <div className="p-3 sm:p-4 md:p-6 bg-white/30 flex-1 flex flex-col min-h-0">
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
            <FileEdit className="w-3.5 h-3.5" />
            <span>Soạn câu hỏi</span>
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
            <span>Xem trước đề</span>
            {docQuestions.length > 0 && (
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                {docQuestions.length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 flex-1 items-start">
          {/* Panel 1: EDITOR / COMPILER FORM (Trái) */}
          <div 
            ref={leftPanelRef}
            className={`bg-white/50 rounded-2xl border border-white/50 shadow-sm overflow-hidden flex flex-col flex-1 h-auto ${mobileView === "edit" ? "flex" : "hidden lg:flex"}`}
          >
            {/* Sub-Header: Settings */}
            <div id="tour-qbuilder-config-header" className="bg-white/40 px-4 py-3 md:px-5 md:py-4 border-b border-slate-200/80">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-xs md:text-sm font-bold text-slate-800 whitespace-nowrap">
                    Cấu hình tiêu đề tài liệu
                  </span>
                </div>
                {/* Style toggle */}
                <div className="flex bg-slate-200/60 p-1 rounded-xl text-xs font-bold gap-1 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => { setDocHeaderStyle("centered"); setIsHeaderOpen(prev => docHeaderStyle === "centered" ? !prev : true); }}
                    className={`flex-1 sm:flex-none text-center justify-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${docHeaderStyle === "centered" ? "bg-white text-slate-900 shadow-3xs font-extrabold" : "text-slate-600 hover:text-slate-805"}`}
                  >
                    Căn giữa (Đơn)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDocHeaderStyle("split"); setIsHeaderOpen(prev => docHeaderStyle === "split" ? !prev : true); }}
                    className={`flex-1 sm:flex-none text-center justify-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${docHeaderStyle === "split" ? "bg-white text-slate-900 shadow-3xs font-extrabold" : "text-slate-600 hover:text-slate-805"}`}
                  >
                    Khung đôi Bộ GD
                  </button>
                </div>
              </div>

              {isHeaderOpen && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t border-slate-200/50 pt-4 mt-4">
                  {docHeaderStyle === "centered" ? (
                    <div className="space-y-2.5 animate-fade-in">
                      <input
                        type="text"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="VD: ĐỀ THI THỬ THPT QUỐC GIA MÔN TOÁN"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-805 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all shadow-3xs"
                      />
                      <input
                        type="text"
                        value={docSubtitle}
                        onChange={(e) => setDocSubtitle(e.target.value)}
                        placeholder="VD: Thời gian làm bài: 90 phút"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all shadow-3xs"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left animate-fade-in">
                      {/* Cột trái */}
                      <div className="space-y-3.5 pr-0 sm:pr-4 sm:border-r border-slate-200/80 pb-3.5 sm:pb-0 border-b sm:border-b-0 border-slate-200/60">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-1">
                          BÊN TRÁI (THÔNG TIN HỌC SINH)
                        </span>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                            Họ tên, Lớp, STT:
                          </label>
                          <textarea
                            rows={2}
                            value={docStudentInfoFormat}
                            onChange={(e) =>
                              setDocStudentInfoFormat(e.target.value)
                            }
                            placeholder="Họ và tên: ....................................................\nLớp: ................... STT: ........."
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-805 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none leading-relaxed shadow-3xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                            Thời gian làm bài:
                          </label>
                          <input
                            type="text"
                            value={docTimeLimit}
                            onChange={(e) =>
                              setDocTimeLimit(e.target.value)
                            }
                            placeholder="90 phút (Không kể thời gian phát đề)"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-3xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                            Đề số / Mã đề:
                          </label>
                          <input
                            type="text"
                            value={docExamCode}
                            onChange={(e) => setDocExamCode(e.target.value)}
                            placeholder="101"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-3xs"
                          />
                        </div>
                      </div>

                      {/* Cột phải */}
                      <div className="space-y-3.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-1">
                          BÊN PHẢI (TRƯỜNG & KỲ THI)
                        </span>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                            Tên Trường / Sở GD:
                          </label>
                          <input
                            type="text"
                            value={docSchoolName}
                            onChange={(e) =>
                              setDocSchoolName(e.target.value)
                            }
                            placeholder="TRƯỜNG THPT CHUYÊN QUỐC GIA"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-3xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                            Kỳ thi:
                          </label>
                          <input
                            type="text"
                            value={docExamName}
                            onChange={(e) => setDocExamName(e.target.value)}
                            placeholder="KỲ THI THỬ TỐT NGHIỆP THPT"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-3xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                            Môn thi:
                          </label>
                          <input
                            type="text"
                            value={docSubjectName}
                            onChange={(e) =>
                              setDocSubjectName(e.target.value)
                            }
                            placeholder="Môn thi: TOÁN HỌC"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-3xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Collapse Toggle Button */}
              
            </div>

            {/* Form input elements */}
            <div
              id="tour-qbuilder-type-selector"
              className="p-4 md:p-5 pb-6 space-y-4 flex-1 flex flex-col"
            >
              {editingQuestionId &&
                (() => {
                  const idx = docQuestions.findIndex(
                    (q) => q.id === editingQuestionId,
                  );
                  if (idx === -1) return null;
                  const q = docQuestions[idx];
                  const sameTypeQuestions = docQuestions.filter(
                    (item) => item.type === q.type,
                  );
                  const displayNum =
                    sameTypeQuestions.findIndex(
                      (item) => item.id === q.id,
                    ) + 1;
                  const typeLabel =
                    q.type === "trac_nghiem"
                      ? "Trắc nghiệm"
                      : "Tự luận";
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-855 font-medium select-none animate-fade-in">
                      <div className="flex items-start sm:items-center gap-2 leading-relaxed">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mt-1 sm:mt-0 shrink-0" />
                        <span>
                          Bạn đang chỉnh sửa câu hỏi: <strong>Câu {displayNum}</strong> ({typeLabel})
                        </span>
                      </div>
                      <button
                        
                        onClick={() => {
                          setEditingQuestionId(null);
                          setTracNghiemText("");
                          setTracNghiemAnswerText("");
                          setDungSaiText("");
                          setDungSaiAnswerText("");
                          setTraLoiNganText("");
                          setTraLoiNganAnswerText("");
                          setTuLuanQuestionText("");
                          setTuLuanAnswerText("");
                          triggerToast("Đã hủy bỏ chỉnh sửa.", true);
                        }}
                        className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-100/50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-amber-200"
                      >
                        Hủy bỏ
                      </button>
                    </div>
                  );
                })()}

              {/* Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-2 select-none">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span className="hidden xs:inline">Phân loại câu hỏi mới</span>
                    <span className="xs:hidden">Loại câu hỏi</span>
                  </label>
                  <button
                    
                    onClick={() => setShowSmartPasteModal(true)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-3xs active:scale-95"
                    title="Dán câu hỏi và đáp án từ AI để tự động phân tách"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>
                      <span className="hidden xs:inline">Dán thông minh (AI)</span>
                      <span className="xs:hidden">Dán AI</span>
                    </span>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/80 select-none">
                  {[
                    { id: "trac_nghiem", label: "TN 4 Lựa chọn", shortLabel: "4 Lựa chọn" },
                    { id: "trac_nghiem_dung_sai", label: "TN Đúng/Sai", shortLabel: "Đúng/Sai" },
                    { id: "trac_nghiem_tra_loi_ngan", label: "TN Trả lời ngắn", shortLabel: "Trả lời ngắn" },
                    { id: "tu_luan", label: "Tự luận", shortLabel: "Tự luận" }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      
                      onClick={() => setNewQuestionType(btn.id as any)}
                      className={`py-2 px-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer text-center ${
                        newQuestionType === btn.id
                          ? "bg-white text-indigo-700 shadow-sm font-black border border-indigo-100 ring-1 ring-indigo-50"
                          : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                      }`}
                    >
                      <span className="hidden sm:inline">{btn.label}</span>
                      <span className="sm:hidden">{btn.shortLabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs based on type */}
              {newQuestionType === "trac_nghiem" ? (
                <div className="space-y-3 animate-fade-in">
                  <div className="mb-1 select-none">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      Khung nhập câu hỏi trắc nghiệm
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Frame: Question and Options */}
                    <div className="space-y-1.5 flex flex-col">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-0.5 select-none h-5 truncate">
                        1. Đề bài & các tùy chọn A, B, C, D <span className="text-rose-500 font-bold">*</span>
                      </span>
                      <textarea
                        value={tracNghiemText}
                        onChange={(e) =>
                          setTracNghiemText(e.target.value)
                        }
                        onPaste={(e) =>
                          handlePasteGeneric(e, setTracNghiemText, true)
                        }
                        rows={4}
                        placeholder="VD: Cho hàm số $y=x+1$, tìm điểm giao với trục hoành.\nA. $(1;0)$\nB. $(-1;0)$\nC. $(0;1)$\nD. $(0;-1)$"
                        className="w-full flex-1 bg-white/40/20 border border-slate-200 rounded-xl p-3.5 text-xs md:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-150 focus:border-indigo-400 focus:bg-white outline-none font-normal leading-relaxed overflow-y-auto transition-all shadow-3xs"
                      />
                    </div>

                    {/* Right Frame: Answer and Solution */}
                    <div className="space-y-1.5 flex flex-col">
                      <span className="text-[11px] font-bold text-slate-500 flex items-center select-none h-5 truncate">
                        2. Đáp án
                      </span>
                      <textarea
                        value={tracNghiemAnswerText}
                        onChange={(e) =>
                          setTracNghiemAnswerText(e.target.value)
                        }
                        onPaste={(e) =>
                          handlePasteGeneric(e, setTracNghiemAnswerText, true)
                        }
                        rows={4}
                        placeholder="VD: Chọn B. Giao điểm với trục hoành có $y = 0 \implies x + 1 = 0 \implies x = -1$."
                        className="w-full flex-1 bg-white/40/20 border border-slate-200 rounded-xl p-3.5 text-xs md:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-150 focus:border-indigo-400 focus:bg-white outline-none font-normal leading-relaxed overflow-y-auto transition-all shadow-3xs"
                      />
                    </div>
                  </div>

                  {/* Column pickers & inline Add button - 1 HÀNG DUY NHẤT TRÊN CẢ MOBILE & DESKTOP */}
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 bg-slate-100/50 p-1.5 sm:p-2 rounded-xl border border-slate-200/80 select-none">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className="text-[11px] sm:text-xs font-bold text-slate-600 shrink-0">
                        <span className="hidden sm:inline">Bố cục đáp án:</span>
                        <span className="sm:hidden">Bố cục:</span>
                      </span>
                      <div className="flex gap-1">
                        {[1, 2, 4].map((cols) => (
                          <button
                            key={cols}
                            type="button"
                            onClick={() => setNewTracNghiemColumns(cols)}
                            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 ${
                              newTracNghiemColumns === cols
                                ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500 scale-[1.03]"
                                : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-3xs"
                            }`}
                          >
                            {cols} cột
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {editingQuestionId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestionId(null);
                            setTracNghiemText("");
                            setTracNghiemAnswerText("");
                            setDungSaiText("");
                            setDungSaiAnswerText("");
                            setTraLoiNganText("");
                            setTraLoiNganAnswerText("");
                            setTuLuanQuestionText("");
                            setTuLuanAnswerText("");
                            triggerToast("Đã hủy bỏ chỉnh sửa.", true);
                          }}
                          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] sm:text-xs cursor-pointer border border-slate-200 transition-all shrink-0"
                        >
                          Hủy
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        className={`px-2.5 sm:px-4 py-1 sm:py-1.5 text-white font-extrabold rounded-lg text-[11px] sm:text-xs flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap transition-all shrink-0 ${
                          editingQuestionId
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {editingQuestionId ? "Lưu sửa" : "Thêm câu hỏi"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className="mb-1 select-none">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {newQuestionType === "trac_nghiem_dung_sai" ? "Khung nhập câu hỏi Trắc nghiệm Đúng/Sai" : newQuestionType === "trac_nghiem_tra_loi_ngan" ? "Khung nhập câu hỏi Trắc nghiệm Trả lời ngắn" : "Khung nhập câu hỏi tự luận"}
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Frame: Question Text - REQUIRED */}
                    <div className="space-y-1.5 flex flex-col">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-0.5 select-none h-5 truncate">
                        1. Nội dung câu hỏi <span className="text-rose-500 font-bold">*</span>
                      </span>
                      <textarea
                        value={newQuestionType === "trac_nghiem_dung_sai" ? dungSaiText : newQuestionType === "trac_nghiem_tra_loi_ngan" ? traLoiNganText : tuLuanQuestionText}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (newQuestionType === "trac_nghiem_dung_sai") setDungSaiText(val);
                          else if (newQuestionType === "trac_nghiem_tra_loi_ngan") setTraLoiNganText(val);
                          else setTuLuanQuestionText(val);
                        }}
                        onPaste={(e) => {
                          if (newQuestionType === "trac_nghiem_dung_sai") handlePasteGeneric(e, setDungSaiText, true);
                          else if (newQuestionType === "trac_nghiem_tra_loi_ngan") handlePasteGeneric(e, setTraLoiNganText, true);
                          else handlePasteGeneric(e, setTuLuanQuestionText, true);
                        }}
                        rows={5}
                        placeholder={
                          newQuestionType === "trac_nghiem_dung_sai" ? "VD: Cho hàm số y = ... Các mệnh đề sau đúng hay sai:\na) Hàm số nghịch biến...\nb) Đồ thị cắt trục tung...\nc) Đạo hàm...\nd) Hàm số đạt cực đại..." :
                          newQuestionType === "trac_nghiem_tra_loi_ngan" ? "VD: Tính thể tích khối chóp..." :
                          "VD: Chứng minh rằng mọi số chẵn lớn hơn 2 đều có thể biểu diễn dưới dạng tổng của hai số nguyên tố."
                        }
                        className="w-full bg-white/40/20 border border-slate-200 rounded-xl p-3.5 text-xs md:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-150 focus:border-indigo-400 focus:bg-white outline-none font-normal leading-relaxed transition-all shadow-3xs"
                      />
                    </div>

                    {/* Right Frame: Answer Text - OPTIONAL */}
                    <div className="space-y-1.5 flex flex-col">
                      <span className="text-[11px] font-bold text-slate-500 flex items-center select-none h-5 truncate">
                        2. Đáp án
                      </span>
                      <textarea
                        value={newQuestionType === "trac_nghiem_dung_sai" ? dungSaiAnswerText : newQuestionType === "trac_nghiem_tra_loi_ngan" ? traLoiNganAnswerText : tuLuanAnswerText}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (newQuestionType === "trac_nghiem_dung_sai") setDungSaiAnswerText(val);
                          else if (newQuestionType === "trac_nghiem_tra_loi_ngan") setTraLoiNganAnswerText(val);
                          else setTuLuanAnswerText(val);
                        }}
                        onPaste={(e) => {
                          if (newQuestionType === "trac_nghiem_dung_sai") handlePasteGeneric(e, setDungSaiAnswerText, true);
                          else if (newQuestionType === "trac_nghiem_tra_loi_ngan") handlePasteGeneric(e, setTraLoiNganAnswerText, true);
                          else handlePasteGeneric(e, setTuLuanAnswerText, true);
                        }}
                        rows={5}
                        placeholder={
                          newQuestionType === "trac_nghiem_dung_sai" ? "VD: a) Đúng\nb) Sai\nc) Đúng\nd) Sai" :
                          newQuestionType === "trac_nghiem_tra_loi_ngan" ? "VD: Đáp án: 12" :
                          "VD: Nhập nội dung hướng dẫn giải chi tiết..."
                        }
                        className="w-full bg-white/40/20 border border-slate-200 rounded-xl p-3.5 text-xs md:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-150 focus:border-indigo-400 focus:bg-white outline-none font-normal leading-relaxed transition-all shadow-3xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Add Button for non-4-choice types */}
              <div className={`flex justify-end items-center gap-2 pt-1 select-none ${newQuestionType === "trac_nghiem" ? "hidden" : "flex"}`}>
                {editingQuestionId && (
                  <button
                    
                    onClick={() => {
                      setEditingQuestionId(null);
                      setTracNghiemText("");
                      setTracNghiemAnswerText("");
                      setDungSaiText("");
                      setDungSaiAnswerText("");
                      setTraLoiNganText("");
                      setTraLoiNganAnswerText("");
                      setTuLuanQuestionText("");
                      setTuLuanAnswerText("");
                      triggerToast("Đã hủy bỏ chỉnh sửa.", true);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center transition-all cursor-pointer shadow-3xs border border-slate-200"
                  >
                    Hủy bỏ
                  </button>
                )}
                <button
                  
                  onClick={handleAddQuestion}
                  className={`px-5 py-2.5 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                    editingQuestionId
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/10"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                  }`}
                >
                  {editingQuestionId ? (
                    <>
                      <span className="hidden xs:inline">CẬP NHẬT CÂU HỎI</span>
                      <span className="xs:hidden">Lưu chỉnh sửa</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden xs:inline">THÊM CÂU HỎI VÀO TÀI LIỆU</span>
                      <span className="xs:hidden">Thêm câu hỏi</span>
                    </>
                  )}
                </button>
              </div>

              <div id="tour-qbuilder-saved-list" className="border-t border-slate-200/80 pt-4 space-y-3">
                <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between select-none">
                  <span className="text-xs font-bold text-slate-500 tracking-wide uppercase flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Danh sách câu hỏi đã lưu ({docQuestions.length})
                  </span>
                </div>

                {docQuestions.length > 0 && (
                  <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1.5 rounded-xl text-[10px] font-bold select-none w-full relative">
                    <button
                      type="button"
                      onClick={() => setSavedQuestionTab("all")}
                      className={`w-full text-center px-1.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap overflow-hidden text-ellipsis relative z-10 ${
                        savedQuestionTab === "all"
                          ? "text-slate-900 font-extrabold"
                          : "text-slate-550 hover:text-slate-900"
                      }`}
                    >
                      {savedQuestionTab === "all" && (
                        <motion.div
                          layoutId="active-qbuilder-tab-pill"
                          className="absolute inset-0 bg-white rounded-lg shadow-3xs border border-slate-200/50 -z-10"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      Tất cả ({docQuestions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedQuestionTab("trac_nghiem")}
                      className={`w-full text-center px-1.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis relative z-10 ${
                        savedQuestionTab === "trac_nghiem"
                          ? "text-blue-700 font-extrabold"
                          : "text-slate-550 hover:text-blue-600"
                      }`}
                    >
                      {savedQuestionTab === "trac_nghiem" && (
                        <motion.div
                          layoutId="active-qbuilder-tab-pill"
                          className="absolute inset-0 bg-white rounded-lg shadow-3xs border border-blue-100 -z-10"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span className="truncate">4 LC ({tracNghiemList.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedQuestionTab("trac_nghiem_dung_sai")}
                      className={`w-full text-center px-1.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis relative z-10 ${
                        savedQuestionTab === "trac_nghiem_dung_sai"
                          ? "text-purple-700 font-extrabold"
                          : "text-slate-550 hover:text-purple-600"
                      }`}
                    >
                      {savedQuestionTab === "trac_nghiem_dung_sai" && (
                        <motion.div
                          layoutId="active-qbuilder-tab-pill"
                          className="absolute inset-0 bg-white rounded-lg shadow-3xs border border-purple-100 -z-10"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                      <span className="truncate">Đ/S ({dungSaiList.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedQuestionTab("trac_nghiem_tra_loi_ngan")}
                      className={`w-full text-center px-1.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis relative z-10 ${
                        savedQuestionTab === "trac_nghiem_tra_loi_ngan"
                          ? "text-teal-700 font-extrabold"
                          : "text-slate-550 hover:text-teal-600"
                      }`}
                    >
                      {savedQuestionTab === "trac_nghiem_tra_loi_ngan" && (
                        <motion.div
                          layoutId="active-qbuilder-tab-pill"
                          className="absolute inset-0 bg-white rounded-lg shadow-3xs border border-teal-100 -z-10"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                      <span className="truncate">Ngắn ({traLoiNganList.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedQuestionTab("tu_luan")}
                      className={`w-full text-center px-1.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis relative z-10 ${
                        savedQuestionTab === "tu_luan"
                          ? "text-rose-700 font-extrabold"
                          : "text-slate-550 hover:text-rose-600"
                      }`}
                    >
                      {savedQuestionTab === "tu_luan" && (
                        <motion.div
                          layoutId="active-qbuilder-tab-pill"
                          className="absolute inset-0 bg-white rounded-lg shadow-3xs border border-rose-100 -z-10"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="truncate">Tự luận ({tuLuanList.length})</span>
                    </button>
                  </div>
                )}

                {docQuestions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 select-none">
                    Chưa có câu hỏi nào trong danh sách. Hãy thêm câu hỏi đầu tiên bằng form phía trên!
                  </p>
                ) : (
                  (() => {
                    const typeOrder: Record<string, number> = {
                      trac_nghiem: 1,
                      trac_nghiem_dung_sai: 2,
                      trac_nghiem_tra_loi_ngan: 3,
                      tu_luan: 4,
                    };

                    const filteredQuestions = docQuestions
                      .filter((q) => {
                        if (savedQuestionTab === "all") return true;
                        return q.type === savedQuestionTab;
                      })
                      .sort((a, b) => {
                        if (savedQuestionTab === "all") {
                          const orderDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
                          if (orderDiff !== 0) return orderDiff;
                        }
                        return 0;
                      });

                    if (filteredQuestions.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 italic p-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 select-none">
                          Không có câu hỏi nào thuộc bộ lọc đang chọn.
                        </p>
                      );
                    }

                    const borderColors: Record<string, string> = {
                      trac_nghiem: "border-l-[3px] border-l-blue-500",
                      trac_nghiem_dung_sai: "border-l-[3px] border-l-purple-500",
                      trac_nghiem_tra_loi_ngan: "border-l-[3px] border-l-teal-500",
                      tu_luan: "border-l-[3px] border-l-rose-500",
                    };

                    const textColors: Record<string, string> = {
                      trac_nghiem: "text-blue-600",
                      trac_nghiem_dung_sai: "text-purple-600",
                      trac_nghiem_tra_loi_ngan: "text-teal-600",
                      tu_luan: "text-rose-600",
                    };

                    const dotColors: Record<string, string> = {
                      trac_nghiem: "bg-blue-500",
                      trac_nghiem_dung_sai: "bg-purple-500",
                      trac_nghiem_tra_loi_ngan: "bg-teal-500",
                      tu_luan: "bg-rose-500",
                    };

                    // Hàm tính số thứ tự câu bắt đầu lại từ 1 theo từng loại
                    const getCategoryIndex = (targetQ: typeof docQuestions[0]) => {
                      const sameTypeQuestions = docQuestions.filter((item) => item.type === targetQ.type);
                      const idx = sameTypeQuestions.findIndex((item) => item.id === targetQ.id);
                      return idx >= 0 ? idx + 1 : 1;
                    };

                    return (
                      <>
                        {/* Mobile Card List (< sm) */}
                        <div className="sm:hidden space-y-2 max-h-[320px] overflow-y-auto pr-0.5 select-none">
                          {filteredQuestions.map((q) => {
                            const isEditing = editingQuestionId === q.id;
                            const origIdx = docQuestions.findIndex((item) => item.id === q.id);
                            const displayNum = getCategoryIndex(q);
                            const typeLabel =
                              q.type === "trac_nghiem"
                                ? "TN 4 LC"
                                : q.type === "trac_nghiem_dung_sai"
                                ? "TN Đúng/Sai"
                                : q.type === "trac_nghiem_tra_loi_ngan"
                                ? "TN Trả lời ngắn"
                                : "Tự luận";

                            return (
                              <div
                                key={q.id}
                                className={`p-2.5 rounded-xl border transition-all ${
                                  isEditing
                                    ? "bg-amber-50/90 border-amber-300 ring-2 ring-amber-200/60 shadow-xs"
                                    : `bg-white/80 border-slate-200/90 shadow-3xs ${borderColors[q.type] || ""}`
                                }`}
                              >
                                {/* Card Header: Câu 1, 2, 3 and Actions */}
                                <div className="flex items-center justify-between gap-2">
                                  <div
                                    onClick={() => handleStartEditQuestion(q)}
                                    className="flex items-center gap-1.5 cursor-pointer font-extrabold text-xs hover:opacity-80 transition-opacity shrink-0"
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[q.type] || "bg-indigo-500"}`} />
                                    <span className={textColors[q.type] || "text-slate-800"}>Câu {displayNum}</span>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-3xs shrink-0 ${
                                        q.type === "trac_nghiem"
                                          ? "bg-blue-100/80 text-blue-800 border-blue-200"
                                          : q.type === "trac_nghiem_dung_sai"
                                          ? "bg-purple-100/80 text-purple-800 border-purple-200"
                                          : q.type === "trac_nghiem_tra_loi_ngan"
                                          ? "bg-teal-100/80 text-teal-800 border-teal-200"
                                          : "bg-rose-100/80 text-rose-800 border-rose-200"
                                      }`}
                                    >
                                      {typeLabel}
                                    </span>
                                    {isEditing && (
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                        Đang sửa
                                      </span>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveQuestion(origIdx, "up")}
                                      disabled={savedQuestionTab !== "all" || origIdx === 0}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs"
                                      title={savedQuestionTab !== "all" ? "Chỉ di chuyển được ở tab Tất cả" : "Di chuyển lên"}
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveQuestion(origIdx, "down")}
                                      disabled={
                                        savedQuestionTab !== "all" || origIdx === docQuestions.length - 1
                                      }
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs"
                                      title={savedQuestionTab !== "all" ? "Chỉ di chuyển được ở tab Tất cả" : "Di chuyển xuống"}
                                    >
                                      ▼
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditQuestion(q)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                                        isEditing
                                          ? "bg-amber-100 text-amber-800 border-amber-300"
                                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200/60"
                                      }`}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestion(q.id)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 cursor-pointer transition-all"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </div>

                                {/* Column selector for multiple choice on mobile */}
                                {q.type === "trac_nghiem" && (
                                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 bg-slate-50/60 -mx-2.5 -mb-2.5 px-2.5 py-1.5 rounded-b-xl">
                                    <span className="text-[11px] font-bold text-slate-500">Cột đáp án:</span>
                                    <div className="inline-flex gap-1 bg-white p-0.5 rounded-md border border-slate-200 shadow-3xs">
                                      {[1, 2, 4].map((c) => (
                                        <button
                                          key={c}
                                          type="button"
                                          onClick={() => handleUpdateQuestionColumns(q.id, c)}
                                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition-all ${
                                            (q.columns || 4) === c
                                              ? "bg-indigo-600 text-white shadow-xs scale-105"
                                              : "bg-transparent hover:bg-slate-100 text-slate-600"
                                          }`}
                                        >
                                          {c} cột
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop Table View (>= sm) */}
                        <div className="hidden sm:block max-h-[225px] overflow-y-auto overflow-x-hidden overscroll-contain border border-slate-200 rounded-xl shadow-3xs select-none w-full">
                          <table className="w-full text-left text-xs border-collapse w-full min-w-0">
                            <thead>
                              <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                                <th className="p-2 sm:p-2.5 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap w-14 bg-slate-100">Thứ tự</th>
                                <th className="p-2 sm:p-2.5 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap w-20 bg-slate-100">Phân loại</th>
                                <th className="p-2 sm:p-2.5 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap w-16 bg-slate-100">Cột</th>
                                <th className="p-2 sm:p-2.5 font-bold uppercase tracking-wider text-[10px] bg-slate-100">Nội dung tóm tắt</th>
                                <th className="p-2.5 sm:p-3 font-bold uppercase tracking-wider text-[10px] text-center whitespace-nowrap w-28">
                                  Thao tác
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredQuestions.map((q) => {
                                const isEditing = editingQuestionId === q.id;
                                const origIdx = docQuestions.findIndex((item) => item.id === q.id);
                                return (
                                  <tr
                                    key={q.id}
                                    className={`border-b border-slate-100 last:border-0 transition-colors ${
                                      isEditing
                                        ? "bg-amber-50 hover:bg-amber-100/70 border-l-[4px] border-l-amber-500"
                                        : `hover:bg-slate-50 ${borderColors[q.type] || ""}`
                                    }`}
                                  >
                                    <td
                                      onClick={() =>
                                        handleStartEditQuestion(q)
                                      }
                                      className={`p-2.5 sm:p-3 font-bold cursor-pointer whitespace-nowrap hover:opacity-80 transition-opacity ${
                                        isEditing
                                          ? "text-amber-700"
                                          : textColors[q.type] || "text-slate-700"
                                      }`}
                                      title="Bấm để chỉnh sửa câu hỏi này"
                                    >
                                      {`Câu ${getCategoryIndex(q)}`}
                                    </td>
                                    <td
                                      onClick={() =>
                                        handleStartEditQuestion(q)
                                      }
                                      className="p-2.5 sm:p-3 cursor-pointer whitespace-nowrap"
                                      title="Bấm để chỉnh sửa câu hỏi này"
                                    >
                                      <span
                                        className={`inline-block whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-3xs ${
                                          q.type === "trac_nghiem"
                                            ? "bg-blue-100/80 text-blue-800 border-blue-200"
                                            : q.type === "trac_nghiem_dung_sai"
                                            ? "bg-purple-100/80 text-purple-800 border-purple-200"
                                            : q.type === "trac_nghiem_tra_loi_ngan"
                                            ? "bg-teal-100/80 text-teal-800 border-teal-200"
                                            : "bg-rose-100/80 text-rose-800 border-rose-200"
                                        }`}
                                      >
                                        {q.type === "trac_nghiem"
                                          ? "TN 4 LC"
                                          : q.type === "trac_nghiem_dung_sai"
                                          ? "TN Đúng/Sai"
                                          : q.type === "trac_nghiem_tra_loi_ngan"
                                          ? "TN Trả lời ngắn"
                                          : "Tự luận"}
                                      </span>
                                    </td>
                                    <td className="p-2.5 sm:p-3 whitespace-nowrap">
                                      {q.type === "trac_nghiem" ? (
                                        <div className="inline-flex gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                          {[1, 2, 4].map((c) => (
                                            <button
                                              key={c}
                                              type="button"
                                              onClick={() =>
                                                handleUpdateQuestionColumns(
                                                  q.id,
                                                  c,
                                                )
                                              }
                                              className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold cursor-pointer transition-all ${
                                                (q.columns || 4) === c
                                                  ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500 scale-[1.03]"
                                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs"
                                              }`}
                                            >
                                              {c}C
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 font-medium italic">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      onClick={() =>
                                        handleStartEditQuestion(q)
                                      }
                                      className="p-2.5 sm:p-3 text-slate-500 truncate max-w-[65px] sm:max-w-[85px] md:max-w-[105px] cursor-pointer hover:text-slate-805 transition-colors font-medium"
                                      title="Bấm để chỉnh sửa câu hỏi này"
                                    >
                                      {getCleanQuestionBody(q.questionText)}
                                    </td>
                                    <td className="p-2.5 sm:p-3 text-center whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleMoveQuestion(origIdx, "up")
                                          }
                                          disabled={savedQuestionTab !== "all" || origIdx === 0}
                                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer text-xs"
                                          title={savedQuestionTab !== "all" ? "Chỉ di chuyển được ở tab Tất cả" : "Di chuyển lên"}
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleMoveQuestion(origIdx, "down")
                                          }
                                          disabled={
                                            savedQuestionTab !== "all" || origIdx === docQuestions.length - 1
                                          }
                                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer text-xs"
                                          title={savedQuestionTab !== "all" ? "Chỉ di chuyển được ở tab Tất cả" : "Di chuyển xuống"}
                                        >
                                          ▼
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleStartEditQuestion(q)
                                          }
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                            isEditing
                                              ? "text-amber-700 bg-amber-100 hover:bg-amber-200"
                                              : "text-indigo-650 hover:text-indigo-800 hover:bg-indigo-50"
                                          }`}
                                          title="Chỉnh sửa câu hỏi này"
                                        >
                                          Sửa
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteQuestion(q.id)
                                          }
                                          className="px-2 py-0.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 cursor-pointer text-[10px] font-bold"
                                          title="Xóa"
                                        >
                                          Xóa
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>

          {/* Panel 2: EXPORT PREVIEW (Phải) */}
          <div 
            id="tour-qbuilder-export-panel" 
            style={leftPanelHeight ? ({ "--left-panel-h": `${leftPanelHeight}px` } as React.CSSProperties) : undefined}
            className={`bg-white/50 rounded-2xl border border-white/50 shadow-sm overflow-hidden flex flex-col w-full flex-1 lg:h-[var(--left-panel-h)] lg:max-h-[var(--left-panel-h)] ${mobileView === "preview" ? "flex h-auto" : "hidden lg:flex"}`}
          >
              {/* Actions Area */}
              <div className="bg-white/40 px-4 py-3 md:px-5 md:py-4 border-b border-slate-200/80 flex flex-col gap-4 select-none">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span className="text-xs md:text-sm font-bold text-slate-800 whitespace-nowrap">
                      Xem trước & Xuất đề thi
                    </span>
                  </div>
                  <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-stretch sm:justify-end mt-2 sm:mt-0">
                    {/* Shuffle button */}
                    <button
                      
                      onClick={() => {
                        if (docQuestions.length === 0) {
                          triggerToast("Không có câu hỏi nào để trộn đề thi!", false);
                          return;
                        }
                        setShowShuffleConfirm(true);
                      }}
                      disabled={docQuestions.length === 0 || isShuffling}
                      className="bg-white hover:bg-white/40 active:bg-slate-100 border border-slate-200 text-slate-700 h-9 px-2 sm:px-4 rounded-xl font-bold text-xs transition-all flex-1 sm:flex-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none shadow-3xs whitespace-nowrap"
                    >
                      {isShuffling ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Đang trộn...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 text-slate-550" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
                          </svg>
                          <span className="hidden xs:inline">Trộn đề thi</span>
                          <span className="xs:hidden">Trộn</span>
                        </>
                      )}
                    </button>

                    {/* Download button */}
                    <button
                      
                      onClick={downloadDocAsWord}
                      disabled={docQuestions.length === 0}
                      className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white h-9 px-2 sm:px-4 rounded-xl font-bold text-xs transition-all shadow-md flex-1 sm:flex-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-95 whitespace-nowrap"
                    >
                      <svg className="w-3.5 h-3.5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span className="hidden xs:inline">Tải Word (.docx)</span>
                      <span className="xs:hidden">Tải Word</span>
                    </button>
                  </div>
                </div>

                {/* Shuffle confirmation row with warning details and AI toggle */}
                {showShuffleConfirm && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col gap-3 animate-fade-in shadow-3xs">
                    <div className="flex items-start gap-2.5">
                      <div className="text-amber-600 shrink-0 mt-0.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-bold text-amber-800">
                          Xác nhận trộn đề thi?
                        </p>
                        <p className="text-[11px] text-amber-700 leading-relaxed font-semibold">
                          Hệ thống sẽ đảo ngẫu nhiên thứ tự câu hỏi và các lựa chọn đáp án để tạo phiên bản đề thi mới hoàn toàn độc lập.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/50 pt-3">
                      {/* Toggle AI mode */}
                      <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50/50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all shadow-3xs">
                        <input
                          type="checkbox"
                          checked={isAIShuffleEnabled}
                          onChange={(e) => setIsAIShuffleEnabled(e.target.checked)}
                          className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600 transition-all"
                        />
                        <span className="flex items-center gap-1 font-bold">
                          <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                          AI thay đổi số liệu
                        </span>
                      </label>

                      <div className="flex gap-2">
                        <button
                          
                          onClick={async () => {
                            await handleShuffleExam();
                            setShowShuffleConfirm(false);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-3xs"
                        >
                          Xác nhận
                        </button>
                        <button
                          
                          onClick={() => setShowShuffleConfirm(false)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document preview container */}
              <div 
                className="p-2 md:p-4 flex-1 overflow-y-auto overscroll-contain min-h-0 bg-white/30 border-b border-slate-150 select-none flex flex-col items-center"
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
              >
                {docQuestions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2 select-none">
                    <p className="text-xs font-semibold">
                      Bản xem trước tài liệu trống. Hãy nhập câu hỏi trên bảng chỉnh sửa bên trái để tự động đồng hóa ở đây.
                    </p>
                  </div>
                ) : (
                  /* Real live paper style rendering target */
                  <div
                    ref={docPreviewRef}
                    style={{ fontFamily: wordFont }}
                    className="preview-content bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-full w-full overflow-x-auto overflow-y-hidden leading-relaxed text-sm md:text-base text-slate-850 space-y-6 select-none relative animate-fade-in"
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                  >
                    {/* Title header block */}
                    {docHeaderStyle === "centered" ? (
                      <div className="doc-header-block text-center space-y-2 border-b-2 border-double border-slate-800 pb-4">
                        <h3 className="doc-title-text font-black text-slate-900 tracking-tight uppercase text-center text-sm md:text-base leading-tight">
                          {docTitle || "TIÊU ĐỀ TÀI LIỆU"}
                        </h3>
                        <p className="doc-subtitle-text text-xs font-semibold text-slate-500 italic">
                          {docSubtitle ||
                            "Thông tin chi tiết thời gian, phân ban"}
                        </p>
                      </div>
                    ) : (
                      <div className="doc-header-block border-b-4 border-double border-slate-800 pb-4 select-none overflow-x-auto">
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            border: "none",
                          }}
                          className="doc-header-table w-full border-none text-xs md:text-sm"
                        >
                          <tbody>
                            <tr style={{ border: "none" }}>
                              <td
                                style={{
                                  width: "50%",
                                  verticalAlign: "top",
                                  textAlign: "left",
                                  padding: "4px",
                                  border: "none",
                                }}
                                className="w-1/2 align-top text-left p-1"
                              >
                                <div className="font-bold text-slate-800 space-y-1.5 text-xs md:text-[13px] leading-relaxed">
                                  <div className="whitespace-pre-wrap leading-relaxed text-slate-900">
                                    {docStudentInfoFormat ||
                                      `Họ và tên: ....................................................\nLớp: ................... STT: .........`}
                                  </div>
                                  <div className="text-slate-500 font-bold text-[11px] md:text-xs mt-2 uppercase tracking-wide">
                                    Thời gian làm bài:{" "}
                                    <span className="text-slate-800">{docTimeLimit || "90 phút"}</span>
                                  </div>
                                  {docExamCode && (
                                    <div className="text-slate-800 font-black text-xs md:text-[13px] mt-1.5 bg-slate-100 inline-block px-2 py-0.5 rounded border border-slate-200">
                                      Mã đề: {docExamCode}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td
                                style={{
                                  width: "50%",
                                  verticalAlign: "top",
                                  textAlign: "center",
                                  padding: "4px",
                                  border: "none",
                                }}
                                className="w-1/2 align-top text-center p-1 border-l border-slate-200"
                              >
                                <div className="space-y-1 text-xs md:text-[13px] font-bold text-slate-850 leading-tight">
                                  <div className="uppercase font-black text-slate-900 tracking-wide">
                                    {docSchoolName ||
                                      "SỞ GIÁO DỤC VÀ ĐÀO TẠO"}
                                  </div>
                                  <div className="uppercase text-[11px] text-slate-500 mt-1">
                                    {docExamName ||
                                      "KỲ THI THỬ TỐT NGHIỆP"}
                                  </div>
                                  <div className="text-slate-900 font-black text-xs md:text-sm mt-1.5 tracking-tight border-t border-slate-100 pt-1 uppercase">
                                    {docSubjectName || "MÔN THI"}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* List of Questions inside document */}
                    <div className="space-y-6 select-none text-left">
                      {tracNghiemList.length > 0 && (
                        <div className="space-y-4">
                          <div className="doc-section-header font-black text-slate-900 border-b border-slate-300 pb-1.5 text-left text-xs md:text-sm uppercase tracking-wide flex items-center justify-between">
                            <span className="doc-section-title">
                              {labelTracNghiem}
                            </span>
                          </div>
                          <div className="space-y-5">
                            {tracNghiemList.map((q, idx) => {
                              const displayNum = idx + 1;
                              const parsed = parseMultipleChoice(
                                q.questionText,
                              );
                              const cleanBody = getCleanQuestionBody(
                                parsed.questionBody,
                              );
                              return (
                                <div
                                  key={q.id}
                                  className="doc-question-item space-y-2 border-l-2 border-slate-100 pl-3 hover:border-indigo-400 transition-colors py-1"
                                >
                                  <div className="flex items-start gap-1">
                                    {!hasQuestionPrefix(cleanBody) && (
                                      <span className="doc-type-badge font-bold text-slate-900 select-none shrink-0 mr-1">
                                        Câu {displayNum}.
                                      </span>
                                    )}
                                    <div
                                      className="text-slate-800 font-normal leading-relaxed overflow-x-auto select-all w-full text-left"
                                      dangerouslySetInnerHTML={{
                                        __html:
                                          renderContentWithMath(
                                            cleanBody,
                                          ),
                                      }}
                                    />
                                  </div>

                                  {parsed.options.length > 0 && (
                                    <div
                                      className={`doc-options-container grid gap-2 mt-2 ${
                                        (q.columns || 4) === 4
                                          ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
                                          : (q.columns || 4) === 2
                                          ? "grid-cols-1 sm:grid-cols-2"
                                          : "grid-cols-1"
                                      }`}
                                      data-columns={q.columns || 4}
                                    >
                                      {parsed.options.map((opt, oIdx) => (
                                        <div
                                          key={oIdx}
                                          className="doc-option-item min-w-0 flex items-start gap-1.5 py-0.5"
                                        >
                                          <span className="doc-option-label font-bold text-slate-900 shrink-0 select-none">
                                            {opt.label}.
                                          </span>
                                          <div
                                            className="doc-option-text min-w-0 flex-1 text-slate-800 text-left whitespace-normal break-words overflow-x-auto"
                                            dangerouslySetInnerHTML={{
                                              __html:
                                                renderContentWithMath(
                                                  opt.text,
                                                  false,
                                                ),
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Fallback multiple choice answer key / detailed solution */}
                                  {q.answerText && (
                                    <div className="doc-answer-block ml-1 p-3 rounded-xl bg-emerald-50/30 border border-emerald-100 text-slate-700 space-y-1 mt-2.5 animate-fade-in">
                                      <span className="doc-answer-title text-[9px] font-black text-emerald-700 uppercase tracking-wider block select-none mb-1">
                                        ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT:
                                      </span>
                                      <div
                                        className="doc-answer-body text-xs md:text-sm font-normal text-slate-600 space-y-1 leading-relaxed overflow-x-auto select-all w-full text-left"
                                        dangerouslySetInnerHTML={{
                                          __html: renderContentWithMath(
                                            q.answerText,
                                          ),
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {dungSaiList.length > 0 && (
                        <div className="space-y-4 pt-2">
                          <div className="doc-section-header font-black text-slate-900 border-b border-slate-300 pb-1.5 text-left text-xs md:text-sm uppercase tracking-wide flex items-center justify-between">
                            <span className="doc-section-title">
                              {labelDungSai}
                            </span>
                          </div>
                          <div className="space-y-5">
                            {dungSaiList.map((q, idx) => {
                              const displayNum = idx + 1;
                              const cleanText = getCleanQuestionBody(
                                q.questionText,
                              );
                              return (
                                <div
                                  key={q.id}
                                  className="doc-question-item space-y-3 border-l-2 border-slate-100 pl-3 hover:border-indigo-400 transition-colors py-1"
                                >
                                  <div className="flex items-start gap-1">
                                    {!hasQuestionPrefix(cleanText) && (
                                      <span className="doc-type-badge font-bold text-slate-900 select-none shrink-0 mr-1">
                                        Câu {displayNum}.
                                      </span>
                                    )}
                                    <div
                                      className="text-slate-800 font-normal leading-relaxed overflow-x-auto select-all w-full text-left"
                                      dangerouslySetInnerHTML={{
                                        __html:
                                          renderContentWithMath(
                                            cleanText,
                                          ),
                                      }}
                                    />
                                  </div>
                                  {q.answerText && (
                                    <div className="doc-answer-block ml-1 p-3 rounded-xl bg-emerald-50/30 border border-emerald-100 text-slate-700 space-y-1 animate-fade-in">
                                      <span className="doc-answer-title text-[9px] font-black text-emerald-700 uppercase tracking-wider block select-none mb-1">
                                        ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT:
                                      </span>
                                      <div
                                        className="doc-answer-body text-xs md:text-sm font-normal text-slate-600 space-y-1 leading-relaxed overflow-x-auto select-all w-full text-left"
                                        dangerouslySetInnerHTML={{
                                          __html: renderContentWithMath(
                                            q.answerText,
                                          ),
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {traLoiNganList.length > 0 && (
                        <div className="space-y-4 pt-2">
                          <div className="doc-section-header font-black text-slate-900 border-b border-slate-300 pb-1.5 text-left text-xs md:text-sm uppercase tracking-wide flex items-center justify-between">
                            <span className="doc-section-title">
                              {labelTraLoiNgan}
                            </span>
                          </div>
                          <div className="space-y-5">
                            {traLoiNganList.map((q, idx) => {
                              const displayNum = idx + 1;
                              const cleanText = getCleanQuestionBody(
                                q.questionText,
                              );
                              return (
                                <div
                                  key={q.id}
                                  className="doc-question-item space-y-3 border-l-2 border-slate-100 pl-3 hover:border-indigo-400 transition-colors py-1"
                                >
                                  <div className="flex items-start gap-1">
                                    {!hasQuestionPrefix(cleanText) && (
                                      <span className="doc-type-badge font-bold text-slate-900 select-none shrink-0 mr-1">
                                        Câu {displayNum}.
                                      </span>
                                    )}
                                    <div
                                      className="text-slate-800 font-normal leading-relaxed overflow-x-auto select-all w-full text-left"
                                      dangerouslySetInnerHTML={{
                                        __html:
                                          renderContentWithMath(
                                            cleanText,
                                          ),
                                      }}
                                    />
                                  </div>
                                  {q.answerText && (
                                    <div className="doc-answer-block ml-1 p-3 rounded-xl bg-emerald-50/30 border border-emerald-100 text-slate-700 space-y-1 animate-fade-in">
                                      <span className="doc-answer-title text-[9px] font-black text-emerald-700 uppercase tracking-wider block select-none mb-1">
                                        ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT:
                                      </span>
                                      <div
                                        className="doc-answer-body text-xs md:text-sm font-normal text-slate-600 space-y-1 leading-relaxed overflow-x-auto select-all w-full text-left"
                                        dangerouslySetInnerHTML={{
                                          __html: renderContentWithMath(
                                            q.answerText,
                                          ),
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {tuLuanList.length > 0 && (
                        <div className="space-y-4 pt-2">
                          <div className="doc-section-header font-black text-slate-900 border-b border-slate-300 pb-1.5 text-left text-xs md:text-sm uppercase tracking-wide flex items-center justify-between">
                            <span className="doc-section-title">
                              {labelTuLuan}
                            </span>
                          </div>
                          <div className="space-y-5">
                            {tuLuanList.map((q, idx) => {
                              const displayNum = idx + 1;
                              const cleanText = getCleanQuestionBody(
                                q.questionText,
                              );
                              return (
                                <div
                                  key={q.id}
                                  className="doc-question-item space-y-3 border-l-2 border-slate-100 pl-3 hover:border-indigo-400 transition-colors py-1"
                                >
                                  <div className="flex items-start gap-1">
                                    {!hasQuestionPrefix(cleanText) && (
                                      <span className="doc-type-badge font-bold text-slate-900 select-none shrink-0 mr-1">
                                        Câu {displayNum}.
                                      </span>
                                    )}
                                    <div
                                      className="text-slate-800 font-normal leading-relaxed overflow-x-auto select-all w-full text-left"
                                      dangerouslySetInnerHTML={{
                                        __html:
                                          renderContentWithMath(
                                            cleanText,
                                          ),
                                      }}
                                    />
                                  </div>

                                  {/* If essay / written type, show answer/solution area if it has text */}
                                  {q.answerText && (
                                    <div className="doc-answer-block ml-1 p-3 rounded-xl bg-emerald-50/30 border border-emerald-100 text-slate-700 space-y-1 animate-fade-in">
                                      <span className="doc-answer-title text-[9px] font-black text-emerald-700 uppercase tracking-wider block select-none mb-1">
                                        ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT:
                                      </span>
                                      <div
                                        className="doc-answer-body text-xs md:text-sm font-normal text-slate-600 space-y-1 leading-relaxed overflow-x-auto select-all w-full text-left"
                                        dangerouslySetInnerHTML={{
                                          __html: renderContentWithMath(
                                            q.answerText,
                                          ),
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>


                  </div>
                )}
              </div>


            </div>
          </div>
        </div>
      </div>
  );
};

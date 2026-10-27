import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  FileText, 
  Pencil, 
  Layout, 
  ArrowRight, 
  Search, 
  Command, 
  CheckCircle2, 
  Zap, 
  ChevronRight,
  BookOpen,
  TrendingUp,
  Layers,
  Compass,
  FileSpreadsheet,
  LayoutGrid
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SpotlightCard } from "./ui/SpotlightCard";
import { ParticleField, HeroVisual } from "./HeroVisual";
import { 
  LatexMiniDemo, 
  ExamMiniDemo, 
  GeometryMiniDemo, 
  MarkItDownMiniDemo 
} from "./HeroDemos";

interface HeroStudioProps {
  user: any;
  userDoc: any;
  onNavigate: (view: string) => void;
  onOpenPricing: () => void;
  onOpenCommandPalette?: () => void;
  isAdmin: boolean;
  isApproved: boolean;
  currentMultiplier?: number;
}

export const HeroStudio: React.FC<HeroStudioProps> = ({
  user,
  userDoc,
  onNavigate,
  onOpenPricing,
  onOpenCommandPalette,
  isAdmin,
  isApproved,
  currentMultiplier
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [activeDemoTab, setActiveDemoTab] = useState<"latex" | "exam" | "geometry" | "markitdown">("latex");

  useEffect(() => {
    if (isSearchOpen) {
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  const demoTabs = [
    { id: "latex", title: "LaTeX Converter", badge: "Word → LaTeX", icon: Sparkles, color: "text-indigo-600", activeBg: "bg-indigo-600" },
    { id: "exam", title: "Soạn Đề Thi", badge: "AI Trắc Nghiệm", icon: FileText, color: "text-purple-600", activeBg: "bg-purple-600" },
    { id: "geometry", title: "Hình Vẽ AI", badge: "TikZ & SVG", icon: Compass, color: "text-amber-600", activeBg: "bg-amber-600" },
    { id: "markitdown", title: "MarkItDown", badge: "Đa Định Dạng", icon: FileSpreadsheet, color: "text-emerald-600", activeBg: "bg-emerald-600" },
  ];

  const handleOpenSearch = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      setIsSearchOpen(true);
    }
  };

  const displayName = 
    userDoc?.displayName || 
    user?.displayName || 
    user?.email?.split("@")[0] || 
    "Thầy Cô & Bạn";

  const quickActions = [
    {
      id: "latex",
      title: "Chuyển Đổi LaTeX",
      desc: "Word, Ảnh công thức, PDF sang mã LaTeX chuẩn xác cao",
      icon: FileText,
      color: "from-blue-500 to-indigo-600",
      textColor: "text-blue-600",
      bgLight: "bg-blue-50",
      hoverBorder: "hover:border-blue-400",
      hoverText: "group-hover:text-blue-600",
      spotlightColor: "rgba(59, 130, 246, 0.16)", // Màu xanh biển
      badge: "Phổ biến",
      action: () => onNavigate("latex")
    },
    {
      id: "exam",
      title: "Soạn Đề Thi Trắc Nghiệm",
      desc: "Phân loại câu hỏi, trộn đề, trích xuất đáp án và lời giải",
      icon: Pencil,
      color: "from-purple-500 to-indigo-600",
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
      hoverBorder: "hover:border-purple-400",
      hoverText: "group-hover:text-purple-600",
      spotlightColor: "rgba(168, 85, 247, 0.16)", // Màu hơi tím
      badge: "Khảo thí",
      action: () => onNavigate("exam")
    },
    {
      id: "workspace",
      title: "Workspace & Hình Vẽ AI",
      desc: "Vẽ hình học động TikZ/SVG, giải bài tập & sơ đồ tư duy",
      icon: Compass,
      color: "from-amber-500 to-orange-500",
      textColor: "text-amber-600",
      bgLight: "bg-amber-50",
      hoverBorder: "hover:border-amber-400",
      hoverText: "group-hover:text-amber-600",
      spotlightColor: "rgba(245, 158, 11, 0.18)", // Màu cam / vàng
      badge: "Sáng tạo",
      action: () => onNavigate("workspace")
    },
    {
      id: "markitdown",
      title: "MarkItDown Studio",
      desc: "Chuyển PDF, DOCX, PPTX, Video sang Markdown sạch",
      icon: FileSpreadsheet,
      color: "from-emerald-500 to-teal-600",
      textColor: "text-emerald-600",
      bgLight: "bg-emerald-50",
      hoverBorder: "hover:border-emerald-400",
      hoverText: "group-hover:text-emerald-600",
      spotlightColor: "rgba(16, 185, 129, 0.16)", // Màu xanh lá
      badge: "Đa năng",
      action: () => onNavigate("markitdown")
    }
  ];

  // Xử lý bàn phím trong Modal điều hướng nhanh (Tab, Mũi tên lên/xuống, Enter, ESC)
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSearchOpen(false);
        return;
      }

      if (quickActions.length === 0) return;

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex(prev => (prev <= 0 ? quickActions.length - 1 : prev - 1));
        } else {
          setSelectedIndex(prev => (prev + 1 >= quickActions.length ? 0 : prev + 1));
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 >= quickActions.length ? 0 : prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev <= 0 ? quickActions.length - 1 : prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = selectedIndex >= 0 && selectedIndex < quickActions.length
          ? quickActions[selectedIndex]
          : quickActions[0];
        if (target) {
          target.action();
          setIsSearchOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isSearchOpen, selectedIndex, quickActions]);

  return (
    <div className="flex-1 flex flex-col pb-0 select-none pt-0">
      {/* =====================================================================
          MÀN HÌNH ĐẦU TIÊN (FIRST VIEWPORT):
          TOÀN BỘ HERO BANNER (BAO GỒM 4 THẺ WORKSPACE BÊN TRONG)
          CHIẾM TRỌN 1 MÀN HÌNH, ĐÁY CÁCH TRÌNH DUYỆT VÀI PIXELS
          ===================================================================== */}
      <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] border border-white/80 bg-gradient-to-b from-white/95 via-white/85 to-indigo-50/30 backdrop-blur-md shadow-[0_12px_40px_rgba(99,102,241,0.06)] p-3 sm:p-5 lg:p-6 min-h-0 lg:h-[calc(100dvh-4.5rem)] flex flex-col justify-between mb-3 sm:mb-5">
        {/* Nền hạt toán học tương tác */}
        <ParticleField className="opacity-40" />

        {/* Ambient lighting glows nhẹ không tốn GPU */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 bg-indigo-300/15 rounded-full blur-xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 bg-purple-300/12 rounded-full blur-xl" />

        {/* CỤM NỘI DUNG CHÍNH (RELATIVE Z-10 ĐỂ NỔI TRÊN NỀN PARTICLE) */}
        <div className="relative z-10 max-w-6xl mx-auto w-full h-full flex flex-col justify-between gap-3 lg:gap-4 flex-1">
          {/* PHẦN TRÊN: GRID 2 CỘT (HERO TEXT & HERO VISUAL) - DỜI LÊN TRÊN */}
          <div className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-5 lg:gap-8 pt-1 sm:pt-2 lg:pt-3 pb-2 min-w-0">
            {/* CỘT TRÁI: TIÊU ĐỀ, LỜI CHÀO, NÚT CTA */}
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex-1 min-w-0 flex flex-col items-center lg:items-start text-center lg:text-left will-change-[opacity,transform]"
            >
              {/* Lời chào thân thiện cá nhân hóa */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/90 border border-indigo-100 shadow-2xs mb-2.5 backdrop-blur-md"
              >
                <div className="w-5.5 h-5.5 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-black text-[10px] flex items-center justify-center shadow-3xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span>Xin chào,</span>
                  <span className="text-indigo-700 font-extrabold">{displayName}</span>
                  <span>👋</span>
                </div>
              </div>

              {/* Tiêu đề chính: Chữ đen 1 hàng, chữ xanh tím 1 hàng trên tablet & desktop */}
              <h1
                className="text-2xl sm:text-3xl lg:text-[27px] xl:text-[38px] font-black text-slate-900 tracking-tight leading-[1.2] sm:leading-[1.18] mb-2 sm:mb-3"
              >
                <span className="block whitespace-nowrap">Biến tài liệu khoa học thành</span>
                <span className="block whitespace-nowrap bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 bg-clip-text text-transparent">
                  LaTeX hoàn mỹ &amp; trực quan
                </span>
              </h1>

              {/* Mô tả phụ - rút gọn 2 dòng */}
              <p 
                className="max-w-lg text-xs sm:text-sm text-slate-600 font-medium leading-relaxed mb-3 sm:mb-4 line-clamp-2"
              >
                Giải pháp AI toàn diện hỗ trợ giáo viên: Chuyển đổi Word sang LaTeX và trích xuất đề thi chuẩn xác.
              </p>

              {/* Hàng 2 Nút CTA */}
              <div 
                className="flex items-center justify-center lg:justify-start gap-3 w-full"
              >
                <button
                  type="button"
                  onClick={() => onNavigate("latex")}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Bắt đầu chuyển đổi ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenSearch}
                  className="hidden sm:flex px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200/90 shadow-3xs transition-all items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 shrink-0"
                >
                  <Command className="w-3.5 h-3.5 text-slate-500" />
                  <span>Lệnh nhanh</span>
                  <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 rounded border border-slate-300 text-slate-500 shadow-3xs">
                    Ctrl + K
                  </kbd>
                </button>
              </div>
            </motion.div>

            {/* CỘT PHẢI: Ô DOCUMENT TRANSFORM - KÍCH THƯỚC KHÓA CỐ ĐỊNH ĐỒNG NHẤT KHÔNG CO GIÃN */}
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full lg:w-[460px] xl:w-[500px] shrink-0 min-w-0 flex justify-center lg:justify-end -mt-1 lg:-mt-3"
            >
              <HeroVisual />
            </motion.div>
          </div>

          {/* PHẦN DƯỚI: 4 THẺ TRUY CẬP NHANH */}
          <div className="w-full pt-3 pb-1 border-t border-slate-200/60">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <SpotlightCard
                      className={"group relative h-full flex flex-col justify-between p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white/95 hover:bg-white " + action.hoverBorder + " shadow-2xs sm:shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer backdrop-blur-sm hover:-translate-y-1"}
                      spotlightColor={action.spotlightColor}
                    >
                      <div onClick={action.action} className="flex items-start gap-3">
                        <div className={"w-7.5 h-7.5 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 " + action.bgLight + " " + action.textColor + " shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"}>
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-1.5 mb-0.5 sm:mb-1">
                            <h3 className={"text-xs sm:text-sm font-black text-slate-900 " + action.hoverText + " transition-colors truncate"}>
                              {action.title}
                            </h3>
                            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded bg-slate-100 text-slate-600 self-start sm:self-auto shrink-0">
                              {action.badge}
                            </span>
                          </div>
                          <p className="hidden sm:block text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">
                            {action.desc}
                          </p>
                        </div>
                      </div>

                      <div 
                        onClick={action.action}
                        className={"hidden sm:flex mt-3 pt-2 border-t border-slate-100 items-center justify-between text-[11px] sm:text-xs font-bold " + action.textColor}
                      >
                        <span>Khởi động</span>
                        <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1.5 transition-transform duration-200" />
                      </div>
                    </SpotlightCard>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PHẦN TIẾP THEO KHI CUỘN CHUỘT: TABS MINI-DEMO TƯƠNG TÁC CHI TIẾT
          TỐI ƯU CẢM ỨNG & HIỆU NĂNG MOBILE: CHỌN TAB XEM TỪNG CÔNG CỤ
          ===================================================================== */}
      <div className="space-y-4 sm:space-y-6 pt-2">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-4xl mx-auto px-2 sm:px-4"
        >
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shadow-3xs">
            Trải nghiệm tương tác trực quan
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
            Khám Phá Sức Mạnh 4 Công Cụ Cốt Lõi
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl sm:max-w-none sm:whitespace-nowrap mx-auto leading-relaxed">
            Mỗi công cụ được thiết kế chuyên biệt để tối ưu từng khâu trong quy trình soạn thảo khoa học.
          </p>
        </motion.div>

        {/* BỘ THANH ĐIỀU KHIỂN TABS CHUẨN MOBILE & DESKTOP */}
        <div className="flex items-center justify-center px-1 sm:px-2">
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs max-w-full overflow-x-auto no-scrollbar">
            {demoTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeDemoTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveDemoTab(tab.id as any)}
                  className={`relative isolate flex items-center px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                    isActive
                      ? "text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="overview-demo-tab-pill"
                      className={`absolute inset-0 rounded-xl z-0 ${tab.activeBg}`}
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                    <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? "text-white" : tab.color}`} />
                    <span className={isActive ? "text-white font-black" : ""}>{tab.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold hidden md:inline-block ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {tab.badge}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* KHUNG DEMO TƯƠNG TÁC DUY NHẤT VỚI ANIMATION MƯỢT MÀ */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {activeDemoTab === "latex" && (
              <motion.div
                key="latex"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <LatexMiniDemo onExplore={() => onNavigate("latex")} />
              </motion.div>
            )}

            {activeDemoTab === "exam" && (
              <motion.div
                key="exam"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <ExamMiniDemo onExplore={() => onNavigate("exam")} />
              </motion.div>
            )}

            {activeDemoTab === "geometry" && (
              <motion.div
                key="geometry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <GeometryMiniDemo onExplore={() => onNavigate("workspace")} />
              </motion.div>
            )}

            {activeDemoTab === "markitdown" && (
              <motion.div
                key="markitdown"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <MarkItDownMiniDemo onExplore={() => onNavigate("markitdown")} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* =====================================================================
          MODAL LỆNH NHANH (Command Palette Ctrl + K)
          ===================================================================== */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSearchOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <LayoutGrid className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-800 select-none truncate">
                    Chọn công cụ hoặc tính năng...
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md hidden sm:inline-block">
                    Tab để chọn
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    ESC
                  </button>
                </div>
              </div>

              <div className="p-3 max-h-80 overflow-y-auto space-y-1">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={action.id}
                      onClick={() => {
                        action.action();
                        setIsSearchOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={"flex items-center justify-between p-3 rounded-2xl cursor-pointer group transition-all " +
                        (isSelected ? "bg-indigo-50 border border-indigo-200/90 shadow-2xs" : "hover:bg-slate-50 border border-transparent")
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className={"w-9 h-9 rounded-xl flex items-center justify-center " + action.bgLight + " " + action.textColor + (isSelected ? " scale-105" : "")}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={"text-xs font-black transition-colors " + (isSelected ? "text-indigo-700" : "text-slate-900 group-hover:text-indigo-700")}>
                            {action.title}
                          </div>
                          <div className="text-[11px] text-slate-500">{action.desc}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-100/70 px-1.5 py-0.5 rounded border border-indigo-200 hidden sm:inline-block">
                            Enter ↵
                          </span>
                        )}
                        <ChevronRight className={"w-4 h-4 transition-transform " + (isSelected ? "text-indigo-600 translate-x-1" : "text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5")} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

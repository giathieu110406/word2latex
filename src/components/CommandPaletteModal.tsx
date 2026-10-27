import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Compass,
  FileText,
  Pencil,
  FileSpreadsheet,
  ChevronRight,
  CreditCard,
  MessageSquarePlus,
  Bell,
  LayoutGrid
} from "lucide-react";

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onOpenPricing?: () => void;
  onOpenFeedback?: () => void;
  onOpenNotifications?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenPricing,
  onOpenFeedback,
  onOpenNotifications
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Danh sách công cụ & tính năng toàn hệ thống
  const quickActions = [
    {
      id: "latex",
      title: "Chuyển Đổi LaTeX",
      desc: "Word, Ảnh công thức, PDF sang mã LaTeX chuẩn xác cao",
      icon: FileText,
      textColor: "text-blue-600",
      bgLight: "bg-blue-50",
      action: () => {
        onNavigate("latex");
        onClose();
      }
    },
    {
      id: "qbuilder",
      title: "Soạn Đề Thi Trắc Nghiệm",
      desc: "Phân loại câu hỏi, trộn đề, trích xuất đáp án và lời giải",
      icon: Pencil,
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
      action: () => {
        onNavigate("qbuilder");
        onClose();
      }
    },
    {
      id: "drawing",
      title: "Workspace & Hình Vẽ AI",
      desc: "Vẽ hình học động TikZ/SVG, giải bài tập & sơ đồ tư duy",
      icon: Compass,
      textColor: "text-amber-600",
      bgLight: "bg-amber-50",
      action: () => {
        onNavigate("drawing");
        onClose();
      }
    },
    {
      id: "markitdown",
      title: "MarkItDown Studio",
      desc: "Chuyển PDF, DOCX, PPTX, Video sang Markdown sạch",
      icon: FileSpreadsheet,
      textColor: "text-emerald-600",
      bgLight: "bg-emerald-50",
      action: () => {
        onNavigate("markitdown");
        onClose();
      }
    },
    {
      id: "pricing",
      title: "Bảng Giá & Gói Dịch Vụ",
      desc: "Nâng cấp gói tài khoản, mở khóa tính năng nâng cao",
      icon: CreditCard,
      textColor: "text-rose-600",
      bgLight: "bg-rose-50",
      action: () => {
        if (onOpenPricing) onOpenPricing();
        else onNavigate("pricing");
        onClose();
      }
    },
    {
      id: "feedback",
      title: "Góp Ý & Báo Lỗi Trải Nghiệm",
      desc: "Gửi phản hồi, vẽ khoanh vùng trực tiếp trên màn hình",
      icon: MessageSquarePlus,
      textColor: "text-indigo-600",
      bgLight: "bg-indigo-50",
      action: () => {
        if (onOpenFeedback) onOpenFeedback();
        onClose();
      }
    },
    {
      id: "notifications",
      title: "Thông Báo Hệ Thống & Khảo Sát",
      desc: "Xem cập nhật phiên bản mới nhất và tham gia bình chọn ý kiến",
      icon: Bell,
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
      action: () => {
        if (onOpenNotifications) onOpenNotifications();
        onClose();
      }
    }
  ];

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Điều hướng bằng bàn phím: Tab / ArrowDown / ArrowUp để chọn, Enter để mở, ESC để thoát
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (quickActions.length === 0) return;

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex((prev) => (prev <= 0 ? quickActions.length - 1 : prev - 1));
        } else {
          setSelectedIndex((prev) => (prev + 1) % quickActions.length);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % quickActions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev <= 0 ? quickActions.length - 1 : prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
        if (quickActions[targetIndex]) {
          quickActions[targetIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, selectedIndex, quickActions, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            {/* Header: Không nhập tìm kiếm, hiển thị danh mục chọn kèm phím tắt Tab & ESC */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <LayoutGrid className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="text-sm font-bold text-slate-800 select-none truncate">
                  Chọn công cụ hoặc tính năng... (toàn hệ thống)
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md hidden sm:inline-block">
                  Tab để chọn
                </span>
                <button
                  type="button"
                  onClick={onClose}
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
                    onClick={action.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={
                      "flex items-center justify-between p-3 rounded-2xl cursor-pointer group transition-all " +
                      (isSelected
                        ? "bg-indigo-50 border border-indigo-200/90 shadow-2xs"
                        : "hover:bg-slate-50 border border-transparent")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={
                          "w-9 h-9 rounded-xl flex items-center justify-center " +
                          action.bgLight +
                          " " +
                          action.textColor +
                          (isSelected ? " scale-105" : "")
                        }
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div
                          className={
                            "text-xs font-black transition-colors " +
                            (isSelected
                              ? "text-indigo-700"
                              : "text-slate-900 group-hover:text-indigo-700")
                          }
                        >
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
                      <ChevronRight
                        className={
                          "w-4 h-4 transition-transform " +
                          (isSelected
                            ? "text-indigo-600 translate-x-1"
                            : "text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5")
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

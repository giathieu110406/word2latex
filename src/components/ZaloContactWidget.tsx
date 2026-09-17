import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

export const ZALO_BANNER_MESSAGES = [
  "NẾU BẠN KHÔNG ĐĂNG NHẬP ĐƯỢC LÀ DO WEB LỖI. LIÊN HỆ NGAY ĐỂ ĐĂNG NHẬP",
  "Cần hỗ trợ gấp? Chat Zalo ngay!",
  "Tư vấn nâng cấp tài khoản Pro qua Zalo",
  "Gặp sự cố chuyển đổi? Nhắn Admin nhé!",
];

export const ZALO_PHONE = "0335.784.563";
export const ZALO_LINK = "https://zalo.me/0335784563";

export const ZaloContactWidget: React.FC = () => {
  const [zaloBannerIndex, setZaloBannerIndex] = useState<number>(0);
  const [isZaloWidgetClosed, setIsZaloWidgetClosed] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setZaloBannerIndex((prev) => (prev + 1) % ZALO_BANNER_MESSAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <AnimatePresence>
      {!isZaloWidgetClosed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2.5 sm:gap-3 select-none pointer-events-auto"
        >
          {/* Nút đóng widget */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsZaloWidgetClosed(true);
            }}
            title="Ẩn icon Zalo"
            aria-label="Ẩn icon Zalo"
            className="absolute -top-2.5 -right-2 z-50 w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-slate-700/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/90"
          >
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>

          {/* Bong bóng chat lời nhắn xoay tua */}
          <a
            href={ZALO_LINK}
            target="_blank"
            rel="noreferrer"
            className="group relative hidden sm:flex items-center gap-2.5 bg-white/95 hover:bg-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-lg hover:shadow-xl border border-blue-200/80 hover:border-blue-400 transition-all duration-300 max-w-[280px] cursor-pointer"
          >
            {/* Chấm trạng thái đang hoạt động */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>

            <div className="overflow-hidden min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.p
                  key={zaloBannerIndex}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -7 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs sm:text-[13px] font-bold text-slate-800 leading-tight truncate"
                >
                  {ZALO_BANNER_MESSAGES[zaloBannerIndex]}
                </motion.p>
              </AnimatePresence>
              <span className="text-[10px] sm:text-[11px] font-semibold text-blue-600 group-hover:underline flex items-center gap-1 mt-0.5">
                <span>Chat Zalo: {ZALO_PHONE}</span>
                <span className="text-[10px]">↗</span>
              </span>
            </div>

            {/* Mũi tên bong bóng thoại */}
            <div className="hidden sm:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-t border-r border-blue-200/80 transform rotate-45 group-hover:border-blue-400 transition-colors" />
          </a>

          {/* Nút tròn biểu tượng Zalo */}
          <a
            href={ZALO_LINK}
            target="_blank"
            rel="noreferrer"
            className="relative group w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#0068FF] to-[#008fe5] p-0.5 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-300 shrink-0 cursor-pointer"
            title={`Nhắn tin hỗ trợ qua Zalo (${ZALO_PHONE})`}
          >
            {/* Hiệu ứng radar quét sóng */}
            <span className="absolute -inset-1 rounded-full bg-blue-500/25 animate-ping pointer-events-none -z-10" />

            <div className="w-full h-full rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0068FF] to-[#0055d4]">
              <span className="text-[13px] sm:text-[15px] font-black italic tracking-tighter text-white drop-shadow-xs leading-none">
                Zalo
              </span>
            </div>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ZaloContactWidget;

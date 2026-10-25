import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface ImagePreviewModalProps {
  src: string | null;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ src, onClose }) => {
  return (
    <AnimatePresence>
      {src && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99999] select-none cursor-zoom-out"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative max-w-4xl max-h-[88vh] overflow-hidden rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-3 flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full transition-all cursor-pointer border border-slate-700 font-bold text-sm w-9 h-9 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
              title="Đóng xem ảnh"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
            <img
              src={src}
              alt="Xem trước hình ảnh"
              className="max-w-full max-h-[82vh] object-contain select-text rounded-2xl bg-slate-50 border border-slate-100 shadow-xs"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

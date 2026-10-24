import React from "react";
import { motion, AnimatePresence } from "motion/react";

interface ImagePreviewModalProps {
  src: string | null;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ src, onClose }) => {
  return (
    <AnimatePresence>
      {src && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none cursor-zoom-out"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 bg-slate-950/80 hover:bg-slate-900 text-white rounded-full transition-colors cursor-pointer border border-slate-800 font-bold text-sm w-9 h-9 flex items-center justify-center"
              title="Đóng xem ảnh"
            >
              ✕
            </button>
            <img
              src={src}
              alt="Xem trước hình ảnh"
              className="max-w-full max-h-[85vh] object-contain select-text"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

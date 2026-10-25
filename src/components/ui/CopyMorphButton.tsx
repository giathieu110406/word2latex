import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CopyMorphButtonProps {
  textToCopy: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export const CopyMorphButton: React.FC<CopyMorphButtonProps> = ({
  textToCopy,
  label = "Sao chép LaTeX",
  copiedLabel = "Đã sao chép!",
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 transition-all duration-150 overflow-hidden ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center gap-1.5 text-emerald-600"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{copiedLabel}</span>
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.5, opacity: 0, rotate: 45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: -45 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

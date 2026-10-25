import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SlidingNumberProps {
  value: number;
  className?: string;
}

export const SlidingNumber: React.FC<SlidingNumberProps> = ({ value, className = "" }) => {
  const digits = String(value).split("");

  return (
    <span className={`inline-flex items-center overflow-hidden h-[1.25em] font-mono select-none ${className}`}>
      {digits.map((digit, index) => (
        <span key={`${index}-${digit}`} className="relative inline-block w-[0.62em] h-full overflow-hidden">
          <motion.span
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="absolute inset-0 flex items-center justify-center font-bold"
          >
            {digit}
          </motion.span>
        </span>
      ))}
    </span>
  );
};

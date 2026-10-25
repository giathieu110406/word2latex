import React from "react";
import { motion } from "motion/react";

interface SplittingTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export const SplittingText: React.FC<SplittingTextProps> = ({
  text,
  className = "",
  delay = 0,
}) => {
  const words = text.split(" ");

  return (
    <span className={`inline-block ${className}`}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block whitespace-nowrap mr-[0.25em]">
          {word.split("").map((char, charIndex) => (
            <motion.span
              key={charIndex}
              initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.35,
                delay: delay + (wordIndex * 0.05) + (charIndex * 0.02),
                ease: [0.2, 0.65, 0.3, 0.9],
              }}
              className="inline-block"
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </span>
  );
};

import React from "react";
import { Shield, Info, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface LoginScreenProps {
  onGoogleLogin: () => void;
  authError: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onGoogleLogin,
  authError,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF2FF] via-[#F8FAFC] to-[#F0FDF4]/40 text-slate-850 flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 antialiased font-sans relative overflow-hidden select-none">
      {/* Decorative ambient background floating elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top-left soft sparkle */}
        <div className="absolute top-[12%] left-[8%] text-indigo-300/60 animate-pulse text-2xl font-black">
          ✦
        </div>
        {/* Mid-left sparkle */}
        <div className="absolute top-[45%] left-[5%] text-indigo-200/70 text-lg">
          ✦
        </div>
        {/* Top-right sparkle */}
        <div className="absolute top-[15%] right-[10%] text-sky-300/60 animate-pulse text-xl">
          ✦
        </div>
        {/* Floating subtle ambient blurs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-200/25 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Glass Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="max-w-5xl w-full bg-white/95 backdrop-blur-2xl rounded-[32px] sm:rounded-[40px] border border-white/80 shadow-[0_20px_70px_rgba(15,23,42,0.07)] p-6 sm:p-10 md:p-12 relative z-10 overflow-hidden flex flex-col justify-between"
        id="login-container"
      >
        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* ================= LEFT COLUMN ================= */}
          <div className="flex flex-col items-center text-center">
            {/* App Icon */}
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 shadow-md shadow-indigo-500/10 p-2 flex items-center justify-center mb-3.5 hover:scale-105 transition-transform duration-300">
              <img
                src="/logo.svg"
                alt="Late2Word Logo"
                className="w-full h-full object-contain drop-shadow-xs"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* App Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-snug">
              <span className="text-[#2563EB]">Late2Word</span>{" "}
              <span className="text-slate-900">Converter</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-1 max-w-sm">
              Hệ thống chuyển đổi định dạng và kiểm soát chất lượng dữ liệu
            </p>

            {/* 3D Isometric Document Conversion Illustration */}
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] h-[190px] sm:h-[220px] my-3 flex items-center justify-center">
              <svg
                viewBox="0 0 400 220"
                className="w-full h-full drop-shadow-md select-none pointer-events-none"
              >
                <defs>
                  {/* Soft Cloud Base Glow */}
                  <radialGradient id="cloudGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.8" />
                    <stop offset="60%" stopColor="#F1F5F9" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </radialGradient>

                  {/* Left Purple Document Gradient */}
                  <linearGradient id="purpleDocGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>

                  {/* Right White Document Gradient */}
                  <linearGradient id="whiteDocGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#F8FAFC" />
                  </linearGradient>

                  {/* Arrow Cycle Gradient */}
                  <linearGradient id="arrowCycleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>

                  {/* Drop Shadow for Floating Cards */}
                  <filter id="docShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#4338CA" floodOpacity="0.18" />
                  </filter>

                  <filter id="docShadowRight" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0F172A" floodOpacity="0.12" />
                  </filter>
                </defs>

                {/* Cloud / Surface Glow underneath */}
                <ellipse cx="200" cy="180" rx="160" ry="24" fill="url(#cloudGlow)" />

                {/* Left Document: Purple LaTeX/Text Document (T) */}
                <g filter="url(#docShadow)" transform="translate(75, 30)">
                  {/* Document Body */}
                  <path
                    d="M 10 0 L 70 0 L 95 25 L 95 130 C 95 136, 90 140, 84 140 L 10 140 C 4 140, 0 136, 0 130 L 0 10 C 0 4, 4 0, 10 0 Z"
                    fill="url(#purpleDocGrad)"
                  />
                  {/* Dog-ear corner */}
                  <path d="M 70 0 L 70 25 L 95 25 Z" fill="#C084FC" />

                  {/* "T" Icon Header */}
                  <text x="47" y="48" fill="#FFFFFF" fontSize="28" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
                    T
                  </text>

                  {/* Document text lines */}
                  <rect x="20" y="65" width="55" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.8" />
                  <rect x="20" y="77" width="55" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.8" />
                  <rect x="20" y="89" width="38" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.6" />
                </g>

                {/* Right Document: White/Blue Word Document (W) */}
                <g filter="url(#docShadowRight)" transform="translate(230, 30)">
                  {/* Document Body */}
                  <path
                    d="M 10 0 L 70 0 L 95 25 L 95 130 C 95 136, 90 140, 84 140 L 10 140 C 4 140, 0 136, 0 130 L 0 10 C 0 4, 4 0, 10 0 Z"
                    fill="url(#whiteDocGrad)"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />
                  {/* Dog-ear corner */}
                  <path d="M 70 0 L 70 25 L 95 25 Z" fill="#E2E8F0" />

                  {/* "W" Icon Header */}
                  <text x="47" y="48" fill="#2563EB" fontSize="26" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
                    W
                  </text>

                  {/* Document text lines */}
                  <rect x="20" y="65" width="55" height="4" rx="2" fill="#CBD5E1" />
                  <rect x="20" y="77" width="55" height="4" rx="2" fill="#CBD5E1" />
                  <rect x="20" y="89" width="38" height="4" rx="2" fill="#E2E8F0" />
                </g>

                {/* Cyclical 3D Exchange Arrows in Center */}
                <g transform="translate(170, 75)">
                  {/* Top curved right arrow */}
                  <path
                    d="M 0 20 C 15 2, 45 2, 60 20"
                    fill="none"
                    stroke="url(#arrowCycleGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <polygon points="56,8 68,22 50,26" fill="#6366F1" />

                  {/* Bottom curved left arrow */}
                  <path
                    d="M 60 38 C 45 56, 15 56, 0 38"
                    fill="none"
                    stroke="url(#arrowCycleGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <polygon points="4,50 -8,36 10,32" fill="#3B82F6" />
                </g>

                {/* Floating Miniature Badges / Sparkles */}
                {/* Bottom left mini photo badge */}
                <g transform="translate(40, 125) rotate(-12)">
                  <rect width="22" height="22" rx="6" fill="#C084FC" fillOpacity="0.7" />
                  <circle cx="8" cy="8" r="2.5" fill="#FFFFFF" />
                  <path d="M 4 17 L 10 11 L 18 17 Z" fill="#FFFFFF" fillOpacity="0.9" />
                </g>

                {/* Top right photo badge */}
                <g transform="translate(335, 75) rotate(15)">
                  <rect width="22" height="22" rx="6" fill="#67E8F9" fillOpacity="0.7" />
                  <circle cx="8" cy="8" r="2.5" fill="#FFFFFF" />
                  <path d="M 4 17 L 10 11 L 18 17 Z" fill="#FFFFFF" fillOpacity="0.9" />
                </g>

                {/* Mid right pink sparkle node */}
                <g transform="translate(365, 45) rotate(20)">
                  <circle cx="5" cy="5" r="4" fill="#F472B6" fillOpacity="0.7" />
                  <circle cx="16" cy="14" r="3.5" fill="#F472B6" fillOpacity="0.7" />
                  <line x1="5" y1="5" x2="16" y2="14" stroke="#F472B6" strokeWidth="2.5" strokeOpacity="0.7" />
                </g>

                {/* Bottom right calculator badge */}
                <g transform="translate(345, 120) rotate(8)">
                  <rect width="24" height="24" rx="6" fill="#A5B4FC" fillOpacity="0.8" />
                  <rect x="5" y="5" width="14" height="4" rx="1.5" fill="#FFFFFF" />
                  <circle cx="7" cy="13" r="1.5" fill="#FFFFFF" />
                  <circle cx="12" cy="13" r="1.5" fill="#FFFFFF" />
                  <circle cx="17" cy="13" r="1.5" fill="#FFFFFF" />
                  <circle cx="7" cy="18" r="1.5" fill="#FFFFFF" />
                  <circle cx="12" cy="18" r="1.5" fill="#FFFFFF" />
                  <circle cx="17" cy="18" r="1.5" fill="#FFFFFF" />
                </g>
              </svg>
            </div>

            {/* Bottom Security Assurance Callout */}
            <div className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 shadow-3xs text-left">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100/90 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0 shadow-3xs">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-xs sm:text-[12.5px] text-slate-650 leading-relaxed font-medium">
                Hệ thống yêu cầu xác thực bằng dịch vụ Google bảo mật cao.
                <br />
                Thông tin của bạn luôn được{" "}
                <strong className="text-indigo-700 font-bold">
                  bảo vệ an toàn tuyệt đối
                </strong>
                .
              </p>
            </div>
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="flex flex-col items-center text-center lg:pl-4">
            {/* Official Website Badge */}
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-800 font-extrabold text-[11px] uppercase tracking-wider shadow-3xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>TRANG WEB CHÍNH THỨC</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>

            {/* Domain Name */}
            <a
              href="https://word2latex.io.vn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] via-[#0284C7] to-[#0D9488] hover:opacity-90 transition-opacity mt-4 mb-2 select-all font-display"
            >
              word2latex.io.vn
            </a>

            {/* Domain Description */}
            <p className="text-xs sm:text-sm text-slate-500 font-medium text-center max-w-sm mb-6">
              Truy cập trực tiếp tại đây để có trải nghiệm mượt mà và đầy đủ nhất!
            </p>

            {/* Watermark icon */}
            <div className="mb-4 text-slate-200 flex items-center justify-center">
              <Shield className="w-5 h-5 opacity-40 text-slate-400" />
            </div>

            {/* Auth Error Display (if any) */}
            {authError && (
              <div
                id="auth-error-block"
                className="w-full max-w-md p-3.5 mb-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2 text-left"
              >
                <span>{authError}</span>
              </div>
            )}

            {/* Primary Google Login Button */}
            <button
              type="button"
              onClick={onGoogleLogin}
              className="w-full max-w-md py-4 px-6 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
              title="Đăng nhập siêu nhanh qua tài khoản Google"
            >
              {/* Google G Icon */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#FFFFFF"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#FFFFFF"
                  fillOpacity="0.9"
                />
                <path
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z"
                  fill="#FFFFFF"
                  fillOpacity="0.8"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z"
                  fill="#FFFFFF"
                  fillOpacity="0.95"
                />
              </svg>
              <span>TIẾP TỤC VỚI GOOGLE</span>
            </button>

            {/* Info Box below Button */}
            <div className="w-full max-w-md bg-[#F8FAFC] border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 mt-4 text-xs text-slate-600 shadow-3xs text-left">
              <Info className="w-4.5 h-4.5 text-blue-500 shrink-0" />
              <p className="leading-relaxed">
                Sử dụng tài khoản Google của bạn để đăng nhập nhanh chóng và an toàn.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info at the bottom of the card */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500 font-medium select-text">
          <span>👤 Tác giả: Trần Gia Thiều · </span>
          <a
            href="mailto:Giathieu110406@gmail.com"
            className="text-indigo-600 font-semibold hover:underline ml-1"
          >
            Giathieu110406@gmail.com
          </a>
        </div>
      </motion.div>
    </div>
  );
};

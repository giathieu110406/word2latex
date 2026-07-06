const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// I will just locate the whole end of the file starting from "Image Preview Lightbox Overlay"
// And rewrite it correctly with all the divs.

const startIndex = code.indexOf('{/* Image Preview Lightbox Overlay */}');
if (startIndex !== -1) {
    const newEnd = `{/* Image Preview Lightbox Overlay */}
        <AnimatePresence>
          {previewImageSrc && (
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none cursor-zoom-out"
              onClick={() => setPreviewImageSrc(null)}
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
                  onClick={() => setPreviewImageSrc(null)}
                  className="absolute top-4 right-4 z-50 p-2 bg-slate-950/80 hover:bg-slate-900 text-white rounded-full transition-colors cursor-pointer border border-slate-800 font-bold text-sm w-9 h-9 flex items-center justify-center"
                  title="Đóng xem ảnh"
                >
                  ✕
                </button>
                <img
                  src={previewImageSrc}
                  alt="Xem thử hình ảnh"
                  className="max-w-full max-h-[85vh] object-contain select-text"
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div> {/* This closes max-w-[1600px] or inner container maybe? */}
      
      {/* Footer */}
      <footer className="w-full text-center py-4 bg-white/50 border-t border-slate-200/60 mt-auto shrink-0 select-none px-4">
        <div className="max-w-[1600px] mx-auto space-y-1">
          <p className="text-xs text-slate-500 font-medium">
            Bản quyền thuộc về{" "}
            <strong className="text-slate-800 font-semibold">
              Trần Gia Thiều - Giathieu110406@gmail.com
            </strong>{" "}
            · Phiên bản v3.6
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            © Q-Builder · Số hóa công thức LaTeX · Tự động hóa xây dựng đề thi ·
            Chính xác & Tốc độ.
          </p>
        </div>
      </footer>
    </div> {/* Closes flex-1 overflow-y-auto */}
  </div> {/* Closes flex-1 h-screen overflow-hidden main content wrapper */}
</div> {/* Closes root h-screen w-full flex row */}
  );
}
`;
    
    code = code.substring(0, startIndex) + newEnd;
    fs.writeFileSync('src/App.tsx', code);
}

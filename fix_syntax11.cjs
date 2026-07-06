const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const footerStr = `            <footer className="w-full text-center py-4 bg-white/50 border-t border-slate-200/60 mt-auto shrink-0 select-none px-4">
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
            </footer>`;

const footerIdx = code.lastIndexOf(footerStr);
console.log(footerIdx);

const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `            </div>
        )}
        {sidebarView === 'qbuilder' && (
            {/* DOCUMENT BUILDER / TRÌNH BIÊN SOẠN TÀI LIỆU VÀ ĐỀ THI (v3.3 beta) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">`;
            
const newCode = `            </div>
        )}
        {sidebarView === 'qbuilder' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">
              {/* DOCUMENT BUILDER / TRÌNH BIÊN SOẠN TÀI LIỆU VÀ ĐỀ THI (v3.3 beta) */}`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code);

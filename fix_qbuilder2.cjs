const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /<\/div>\s*\{\/\* DOCUMENT BUILDER \/ TRÌNH BIÊN SOẠN TÀI LIỆU VÀ ĐỀ THI \(v3\.3 beta\) \*\/\}\s*<div className="bg-white rounded-2xl border border-slate-200\/80 shadow-xs overflow-hidden flex flex-col mt-6 md:mt-8">/;

const newCode = `</div>
        )}
        {sidebarView === 'qbuilder' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">
              {/* DOCUMENT BUILDER / TRÌNH BIÊN SOẠN TÀI LIỆU VÀ ĐỀ THI (v3.3 beta) */}`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/App.tsx', code);

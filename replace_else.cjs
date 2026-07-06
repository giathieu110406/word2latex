const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col flex-1">`;
const newCode = `          </div>
        )}
        {sidebarView === 'latex' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col flex-1 h-full">`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('src/App.tsx', code);

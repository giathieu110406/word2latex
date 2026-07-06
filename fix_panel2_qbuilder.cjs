const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  'className="p-5 md:p-6 flex-1 overflow-y-auto max-h-[560px] bg-slate-50/20 border-b border-slate-100 select-none"',
  'className="p-5 md:p-6 flex-1 overflow-y-auto min-h-0 bg-slate-50/20 border-b border-slate-100 select-none"'
);

fs.writeFileSync('src/App.tsx', code);

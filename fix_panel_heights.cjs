const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/h-\[500px\] lg:h-\[600px\]/g, 'min-h-[400px] flex-1');
code = code.replace(/min-h-\[500px\]/g, 'min-h-[400px] flex-1');

// Ensure the grid container expands:
code = code.replace(/<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-1">/g, '<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-1 min-h-0">');
code = code.replace(/<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">/g, '<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start flex-1 min-h-0">');

// For the workspaces layout in qbuilder:
code = code.replace(/<div className="p-4 md:p-6 bg-slate-50\/30 flex-1 flex flex-col">/g, '<div className="p-4 md:p-6 bg-slate-50/30 flex-1 flex flex-col min-h-0">');

// For the markdown and textarea inside latex and qbuilder, they need overflow-y-auto and min-h-0
// Wait, they probably already have overflow-y-auto. Let's check.
fs.writeFileSync('src/App.tsx', code);

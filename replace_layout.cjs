const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// The starting point of the layout wrapper
const startMarker = '<div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col">';
// Let's replace the wrapper
const newWrapper = '<div className="min-h-screen bg-[#F8F9FD] text-slate-800 antialiased font-sans flex flex-row overflow-hidden w-full h-full">';
code = code.replace(startMarker, newWrapper);

fs.writeFileSync('src/App.tsx', code);

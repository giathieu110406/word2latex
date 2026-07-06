const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /<footer className="w-full text-center py-4 bg-white\/50 border-t border-slate-200\/60 mt-auto shrink-0 select-none px-4">[\s\S]*?<\/footer>/;
const match = code.match(regex);
if (match) {
    const footerStr = match[0];
    const footerIdx = code.lastIndexOf(footerStr);
    console.log(footerIdx);
    code = code.substring(0, footerIdx + footerStr.length) + '\n  </div>\n  );\n}';
    fs.writeFileSync('src/App.tsx', code);
}

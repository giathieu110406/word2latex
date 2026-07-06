const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /<footer className="w-full text-center py-4 bg-white\/50 border-t border-slate-200\/60 mt-auto shrink-0 select-none px-4">[\s\S]*?<\/footer>[\s\S]*?\}/;
const match = code.match(regex);
if (match) {
    const footerStr = code.match(/<footer className="w-full text-center py-4 bg-white\/50 border-t border-slate-200\/60 mt-auto shrink-0 select-none px-4">[\s\S]*?<\/footer>/)[0];
    const footerIdx = code.lastIndexOf(footerStr);
    code = code.substring(0, footerIdx + footerStr.length) + '\n    </div>\n    </div>\n  </div>\n  );\n}';
    fs.writeFileSync('src/App.tsx', code);
}

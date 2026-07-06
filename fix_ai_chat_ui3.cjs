const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace('<Save className="w-4 h-4 rotate-[-90deg] -ml-0.5" />', '<ArrowRight className="w-4 h-4" />');
fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /\{\/\* Elegant Sub-navigation Tabs \*\/\}[\s\S]*?<\/div>\s*\{\/\* Sub-tab 1: Members Management \*\/\}/;
code = code.replace(regex, '{/* Sub-tab 1: Members Management */}');

fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/<\/div><\/div><\/div><\/div>\s*\);\s*\}/g, '</div></div></div></div>\n  );\n}');
code = code.replace(/<\/div>\n  \);\n\}/, '</div></div></div></div>\n  );\n}');

fs.writeFileSync('src/App.tsx', code);

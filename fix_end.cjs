const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const footerIdx = code.indexOf('</footer>');
if (footerIdx !== -1) {
  code = code.substring(0, footerIdx + 9);
  code += '\n    </div>\n  </div>\n</div>\n</div>\n  );\n}';
  fs.writeFileSync('src/App.tsx', code);
}

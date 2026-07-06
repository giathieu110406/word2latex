const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the bad block at 4610
code = code.replace(/<\/div><\/div><\/div><\/div>\s*\);\s*\}/, '</div>\n        </div>\n      </div>\n    </div>\n  );\n}');

// Check if we need more closing tags at the very end
const endContent = code.slice(-100);
if (endContent.includes('  );\n}')) {
    // End is fine? Wait, tsc said error at 7573.
}

fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const closingTagsRegex = /<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/;

if (closingTagsRegex.test(code)) {
    code = code.replace(closingTagsRegex, '</div>\n</div>\n</div>\n</div>\n  );\n}');
} else {
    console.log("Could not find 3 closing divs!");
    
    // Maybe there are 4?
    if (/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/.test(code)) {
        console.log("Found 4 closing divs, maybe needs 5?");
        code = code.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/, '</div>\n</div>\n</div>\n</div>\n</div>\n  );\n}');
    } else if (/<\/div>\s*<\/div>\s*\);\s*\}/.test(code)) {
        console.log("Found 2 closing divs, needs 4?");
        code = code.replace(/<\/div>\s*<\/div>\s*\);\s*\}/, '</div>\n</div>\n</div>\n</div>\n  );\n}');
    }
}
fs.writeFileSync('src/App.tsx', code);

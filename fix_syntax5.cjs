const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const badBlockRegex = /<\/div>\s*<\/div>\s*(?:<\/div>\s*)*\);\s*\}/;

const goodBlock = `            </div>
          </div>
        </div>
      </div>
    );
  }`;

// Wait, let me replace it correctly. I will just replace from "đến quản trị viên.\n              </p>\n            </div>\n          </div>" until "  // Determine user constraints"
const startStr = 'gửi yêu cầu đến quản trị viên.\n              </p>\n            </div>\n          </div>';
const startIndex = code.indexOf(startStr);
const endStr = '  // Determine user constraints';
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = startStr + '\n        </div>\n      </div>\n    );\n  }\n\n' + endStr;
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex + endStr.length);
}

fs.writeFileSync('src/App.tsx', code);

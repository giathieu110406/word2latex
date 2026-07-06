const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /<\/footer>\s*<\/div>\s*\);\s*\}/;
const newCode = `      </footer>
    </div>
    </div>
  );
}`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/App.tsx', code);

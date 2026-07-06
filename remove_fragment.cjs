const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `            </div>
          </>
        )}`;
const newCode = `            </div>
        )}`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
// Making sure there are no issues.
fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  'id="question-input-section"\n                      className="p-4 space-y-4 flex-1"',
  'id="question-input-section"\n                      className="p-4 space-y-4 flex-1 overflow-y-auto"'
);
code = code.replace(
  'id="question-input-section"\n                      className="p-4 space-y-4 flex-1 overflow-y-auto overflow-y-auto"',
  'id="question-input-section"\n                      className="p-4 space-y-4 flex-1 overflow-y-auto"'
);

fs.writeFileSync('src/App.tsx', code);

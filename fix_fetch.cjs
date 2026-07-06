const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/\/api\/smart-paste-parse/g, '/api/ai?action=smart-paste-parse');
code = code.replace(/\/api\/exam\/shuffle-ai/g, '/api/ai?action=shuffle-ai');
code = code.replace(/\/api\/gemini-canvas/g, '/api/ai?action=gemini-canvas');
code = code.replace(/\/api\/parse-exam/g, '/api/ai?action=parse-exam');
code = code.replace(/\/api\/fix-logic/g, '/api/ai?action=fix-logic');

fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

code = code.replace(/app\.post\("\/api\/smart-paste-parse"/g, 'app.post("/api/ai/smart-paste-parse"'); // Wait, the frontend is calling /api/ai?action=smart-paste-parse!

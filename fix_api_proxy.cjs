const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');
code = code.replace("if (action === 'shuffle-ai') req.url = '/api/exam/shuffle-ai';", "if (action === 'shuffle-ai') req.url = '/api/exam/shuffle-ai';\n    if (action === 'chat-ai') req.url = '/api/chat-ai';");
fs.writeFileSync('api/index.ts', code);

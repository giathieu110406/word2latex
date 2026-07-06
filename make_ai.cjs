const fs = require('fs');

let indexCode = fs.readFileSync('api/index.ts', 'utf-8');

// I will extract all the endpoints from index.ts and convert them to the Vercel handler in api/ai.ts
// But since the frontend now calls /api/ai?action=..., I should ALSO add a multiplexer in api/index.ts
// so that local dev works perfectly!

let multiplexer = `
// VERCEL PROXY HANDLER (cho local dev)
app.use("/api/ai", async (req, res, next) => {
  const { action } = req.query;
  if (req.method === 'POST') {
    if (action === 'parse-exam') req.url = '/api/parse-exam';
    if (action === 'smart-paste-parse') req.url = '/api/smart-paste-parse';
    if (action === 'fix-logic') req.url = '/api/fix-logic';
    if (action === 'gemini-canvas') req.url = '/api/gemini-canvas';
    if (action === 'shuffle-ai') req.url = '/api/exam/shuffle-ai';
  }
  next();
});
`;

if (!indexCode.includes('VERCEL PROXY HANDLER')) {
  indexCode = indexCode.replace('async function startServer() {', 'async function startServer() {\n' + multiplexer);
  fs.writeFileSync('api/index.ts', indexCode);
}

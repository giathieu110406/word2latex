const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace("<Markdown>{msg.text}</Markdown>", "<div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }} />");
fs.writeFileSync('src/App.tsx', code);

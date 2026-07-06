const fs = require('fs');
const ts = require('typescript');

const code = fs.readFileSync('src/App.tsx', 'utf-8');
const sourceFile = ts.createSourceFile('src/App.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node) {
  // just walking forces it to report errors?
  // No, createSourceFile doesn't throw, it creates nodes with errors.
}
// We can just run esbuild or something that gives a good error message.

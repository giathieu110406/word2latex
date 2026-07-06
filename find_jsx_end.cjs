const fs = require('fs');
const ts = require('typescript');

const code = fs.readFileSync('src/App.tsx', 'utf-8');
const sourceFile = ts.createSourceFile('src/App.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

let syntaxErrors = [];
function walk(node) {
  if (node.kind === ts.SyntaxKind.JsxElement || node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
    // console.log("JSX Element found");
  }
  // Check for diagnostics? 
  ts.forEachChild(node, walk);
}
walk(sourceFile);

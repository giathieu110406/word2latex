const fs = require('fs');
const babel = require('@babel/parser');

const code = fs.readFileSync('src/App.tsx', 'utf-8');
// try to parse by ignoring errors
try {
  const ast = babel.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true
  });
  
  // Find the return statement of App function
  let appReturn = null;
  babel.traverse = require('@babel/traverse').default;
  babel.traverse(ast, {
    ReturnStatement(path) {
      if (path.node.loc.start.line === 4661) {
        appReturn = path.node;
      }
    }
  });
  
  if (appReturn) {
    console.log("Return statement ends at line:", appReturn.loc.end.line);
    console.log("Argument ends at line:", appReturn.argument.loc.end.line);
  } else {
    console.log("Not found");
  }

} catch (e) {
  console.error(e);
}

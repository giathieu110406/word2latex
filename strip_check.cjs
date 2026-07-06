const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
// Very naive strip, but better than nothing
code = code.replace(/\/\*[\s\S]*?\*\//g, '');
code = code.replace(/\/\/.*/g, '');
// code = code.replace(/`[\s\S]*?`/g, '');
// code = code.replace(/'[\s\S]*?'/g, '');
// code = code.replace(/"[\s\S]*?"/g, '');

let braces = 0, parens = 0, brackets = 0;
for (let c of code) {
  if (c === '{') braces++;
  if (c === '}') braces--;
  if (c === '(') parens++;
  if (c === ')') parens--;
  if (c === '[') brackets++;
  if (c === ']') brackets--;
}
console.log('Braces:', braces, 'Parens:', parens, 'Brackets:', brackets);

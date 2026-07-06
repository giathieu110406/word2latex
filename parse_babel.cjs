const fs = require('fs');
const babel = require('@babel/parser');

const code = fs.readFileSync('src/App.tsx', 'utf-8');
try {
  babel.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });
  console.log('Parsed successfully!');
} catch (e) {
  console.error(e);
}

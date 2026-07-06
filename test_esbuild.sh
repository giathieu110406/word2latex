for i in {0..10}; do
  DIVS=$(printf '</div>\n%.0s' $(seq 1 $i))
  cat << INNER > fix.cjs
const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const footerIdx = code.indexOf('</footer>');
code = code.substring(0, footerIdx + 9);
code += '\n' + \`${DIVS}\` + '  );\n}';
fs.writeFileSync('src/App.tsx', code);
INNER
  node fix.cjs
  echo "Trying $i divs..."
  npx esbuild src/App.tsx --jsx=preserve > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "esbuild Success with $i divs!"
    break
  fi
done

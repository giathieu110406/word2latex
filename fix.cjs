const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const footerIdx = code.indexOf('</footer>');
code = code.substring(0, footerIdx + 9);
code += '\n' + `</div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>` + '  );\n}';
fs.writeFileSync('src/App.tsx', code);

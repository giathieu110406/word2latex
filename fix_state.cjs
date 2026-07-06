const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(
  'const [sidebarView, setSidebarView] = useState<string>("latex");',
  'const [sidebarView, setSidebarView] = useState<string>("latex");\n  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(true);'
);
fs.writeFileSync('src/App.tsx', code);

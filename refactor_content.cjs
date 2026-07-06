const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Step 1: Admin condition
code = code.replace(
  '{adminTab === "admin" && isAdminUser(user, userDoc) ? (',
  '{(sidebarView === "members" || sidebarView === "feedbacks" || sidebarView === "notify" || sidebarView === "settings") && isAdminUser(user, userDoc) && ('
);

// Step 3, 4, 5
code = code.replace('{adminSubTab === "members" && (', '{sidebarView === "members" && (');
code = code.replace('{adminSubTab === "feedbacks" && (', '{sidebarView === "feedbacks" && (');
code = code.replace('{adminSubTab === "notify" && (', '{sidebarView === "notify" && (');

fs.writeFileSync('src/App.tsx', code);

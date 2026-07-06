const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf-8');

const openTags = (code.match(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(?<!\/)>/g) || []).map(t => t.match(/<([a-zA-Z][a-zA-Z0-9]*)/)[1]);
const closeTags = (code.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || []).map(t => t.match(/<\/([a-zA-Z][a-zA-Z0-9]*)/)[1]);

const counts = {};
for (const tag of openTags) {
  counts[tag] = (counts[tag] || 0) + 1;
}
for (const tag of closeTags) {
  counts[tag] = (counts[tag] || 0) - 1;
}

for (const tag in counts) {
  if (counts[tag] !== 0) {
    console.log(tag, counts[tag]);
  }
}

const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

const viewMatches = [];
lines.forEach((line, idx) => {
  const m = line.match(/id=["'](view[^"']+|main[^"']+|app[^"']+|dashboard[^"']+|workspace[^"']+)["']/i);
  if (m) {
    viewMatches.push({ line: idx + 1, id: m[1], snippet: line.trim() });
  }
});
console.log('Top level views:', JSON.stringify(viewMatches, null, 2));

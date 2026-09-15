const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (/seal|mộc|school_seal|draggableSeal/i.test(line)) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

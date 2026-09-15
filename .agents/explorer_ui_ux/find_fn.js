const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('function toggleSealPlacementMode') || line.includes('function toggleSignaturePlacementMode')) {
    console.log(`=== Line ${idx + 1}: ${line} ===`);
    console.log(lines.slice(idx, idx + 50).join('\n'));
  }
});

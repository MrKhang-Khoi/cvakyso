const fs = require('fs');

function searchCode(fn) {
  const content = fs.readFileSync(fn, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('toggleSealPlacementMode')) {
      console.log(`${fn}:${i+1}: ${l.trim()}`);
    }
  });
}

searchCode('index.html');
if (fs.existsSync('js')) {
  fs.readdirSync('js').forEach(f => searchCode('js/' + f));
}
if (fs.existsSync('public')) {
  fs.readdirSync('public').forEach(f => searchCode('public/' + f));
}

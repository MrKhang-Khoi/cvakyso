const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('fetch(') || l.includes('fetchJson(')) {
    console.log(`line ${i+1}: ${l.trim()}`);
  }
});

const fs = require('fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const lines = appJs.split('\n');

lines.slice(0, 300).forEach((l, i) => {
  if (/fetch\(|api\//i.test(l)) {
    console.log(`js/app.js:${i+1}: ${l.trim()}`);
  }
});

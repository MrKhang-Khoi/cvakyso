const fs = require('fs');
const content = fs.readFileSync('portal-baocao.html', 'utf8');
const lines = content.split('\n');

const portalFns = [];
lines.forEach((line, idx) => {
  if (/function\s+[a-zA-Z0-9_]+/i.test(line)) {
    portalFns.push({ line: idx + 1, fn: line.trim() });
  }
});
console.log('Portal functions count:', portalFns.length);
console.log(JSON.stringify(portalFns, null, 2));

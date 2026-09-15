const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');
const lines = content.split('\n');

const renderFunctions = [];
lines.forEach((line, idx) => {
  if (/function\s+(render|loadTeacher|loadAdmin|openModal|handleSign|handleReject)/i.test(line)) {
    renderFunctions.push({ line: idx + 1, fn: line.trim() });
  }
});
console.log('Key JS functions count:', renderFunctions.length);
console.log(JSON.stringify(renderFunctions, null, 2));

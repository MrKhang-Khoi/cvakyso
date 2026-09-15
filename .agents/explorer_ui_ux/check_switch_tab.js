const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('function switchTeacherTab')) {
    console.log(lines.slice(idx, idx + 45).join('\n'));
  }
});

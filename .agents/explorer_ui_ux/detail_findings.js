const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'analyzed_findings.json'), 'utf8'));

console.log('=== CONSOLE LOGS ===');
console.log(JSON.stringify(data.consoleLogs, null, 2));

console.log('\n=== OVERFLOW DETAILS ===');
console.log(JSON.stringify(data.overflows, null, 2));

// Group touch target violations by component / text pattern
const touchByElement = {};
data.touchTargetViolations.forEach(t => {
  const key = `${t.view} | <${t.tag} id="${t.id}"> "${t.text}" (${t.width}x${t.height})`;
  if (!touchByElement[key]) {
    touchByElement[key] = { count: 0, sample: t };
  }
  touchByElement[key].count++;
});

console.log('\n=== UNIQUE TOUCH TARGET VIOLATIONS (Top 40) ===');
const uniqueTouch = Object.entries(touchByElement).slice(0, 40);
uniqueTouch.forEach(([k, v]) => {
  console.log(`[${v.count}x] ${k}`);
});

// Group contrast violations
const contrastByElement = {};
data.contrastViolations.forEach(c => {
  const key = `${c.view} | <${c.tag}> "${c.text}" [color: ${c.color}, bg: ${c.bgColor}] -> ratio: ${c.ratio}:1 (required: ${c.requiredRatio}:1)`;
  if (!contrastByElement[key]) {
    contrastByElement[key] = { count: 0, sample: c };
  }
  contrastByElement[key].count++;
});

console.log('\n=== UNIQUE CONTRAST VIOLATIONS (Top 40) ===');
const uniqueContrast = Object.entries(contrastByElement).slice(0, 40);
uniqueContrast.forEach(([k, v]) => {
  console.log(`[${v.count}x] ${k}`);
});

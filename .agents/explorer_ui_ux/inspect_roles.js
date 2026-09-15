const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Look for role definitions, tabs, and workspace sections
console.log('=== SEARCHING FOR TABS AND ROLES ===');
const tabMatches = content.match(/<button[^>]*tab[^>]*>.*?<\/button>/gi) || [];
console.log('Tabs count:', tabMatches.length);
tabMatches.slice(0, 15).forEach(t => console.log('Tab:', t));

// Let lines around viewAdmin and viewTeacher be extracted
const lines = content.split('\n');
console.log('\n=== viewAdmin header (lines 176 - 250) ===');
console.log(lines.slice(175, 250).join('\n'));

console.log('\n=== viewTeacher header (lines 479 - 580) ===');
console.log(lines.slice(478, 580).join('\n'));

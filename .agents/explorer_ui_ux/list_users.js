const fs = require('fs');
const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
console.log('Total users:', users.length);
users.forEach(u => {
  console.log(`id: ${u.id}, user: ${u.username}, pass: ${u.password}, role: ${u.role}, title: ${u.roleTitle}, dept: ${u.department}, canStampSeal: ${u.canStampSeal}`);
});

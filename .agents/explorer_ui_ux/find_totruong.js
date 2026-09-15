const fs = require('fs');
const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
users.forEach(u => {
  if (/tổ trưởng|to_truong|lead|head/i.test(u.role) || /tổ trưởng|to_truong|lead|head/i.test(u.roleTitle)) {
    console.log(`id: ${u.id}, user: ${u.username}, pass: ${u.password}, role: ${u.role}, title: ${u.roleTitle}`);
  }
});

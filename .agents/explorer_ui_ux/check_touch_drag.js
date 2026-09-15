const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('draggableSignatureStamp') || l.includes('initDraggable') || (l.includes('addEventListener') && (l.includes('mousedown') || l.includes('touchstart')))) {
    console.log(`line ${i+1}: ${l.trim().slice(0, 100)}`);
  }
});

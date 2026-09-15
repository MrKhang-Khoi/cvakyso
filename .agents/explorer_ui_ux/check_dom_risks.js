const fs = require('fs');

function checkFile(fn) {
  console.log(`=== AUDITING DOM RISKS IN ${fn} ===`);
  const content = fs.readFileSync(fn, 'utf8');
  const lines = content.split('\n');

  // Find unchecked getElementById calls followed by property access like .value, .innerHTML, .style
  const uncheckedAccess = [];
  lines.forEach((l, i) => {
    // pattern: document.getElementById('...').something without optional chaining or check
    const m = l.match(/document\.getElementById\(['"]([^'"]+)['"]\)\.([a-zA-Z]+)/);
    if (m && !l.includes('?') && !l.includes('if (') && !l.includes('&&')) {
      // Check if previous line had a null check
      const prevLine = i > 0 ? lines[i-1] : '';
      if (!prevLine.includes(m[1])) {
        uncheckedAccess.push({ line: i + 1, id: m[1], prop: m[2], text: l.trim().slice(0, 100) });
      }
    }
  });

  console.log(`Unchecked document.getElementById property accesses: ${uncheckedAccess.length}`);
  uncheckedAccess.slice(0, 20).forEach(x => console.log(`  Line ${x.line}: id="${x.id}".${x.prop} -> ${x.text}`));

  // Check images without width and height attributes (CLS risk)
  const imagesWithoutDim = [];
  const imgRegex = /<img\s+[^>]*>/g;
  lines.forEach((l, i) => {
    let match;
    while ((match = imgRegex.exec(l)) !== null) {
      const tag = match[0];
      if (!tag.includes('width=') && !tag.includes('w-') && !tag.includes('max-w-')) {
        imagesWithoutDim.push({ line: i + 1, tag: tag.slice(0, 100) });
      }
    }
  });
  console.log(`Images without explicit dimensions (CLS risk): ${imagesWithoutDim.length}`);
  imagesWithoutDim.slice(0, 10).forEach(x => console.log(`  Line ${x.line}: ${x.tag}`));
}

checkFile('index.html');
checkFile('portal-baocao.html');
checkFile('js/app.js');

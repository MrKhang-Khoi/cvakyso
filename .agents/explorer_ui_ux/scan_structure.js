const fs = require('fs');
const path = require('path');

function analyzeHtml(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  
  const idRegex = /id=["']([^"']+)["']/g;
  const ids = [];
  lines.forEach((line, idx) => {
    let match;
    while ((match = idRegex.exec(line)) !== null) {
      ids.push({ id: match[1], line: idx + 1, text: line.trim().slice(0, 100) });
    }
  });

  // Find views and modals
  const views = ids.filter(x => /view|modal|overlay|dialog|popup/i.test(x.id));
  
  // Find tables
  const tables = ids.filter(x => /table|tbl|grid|list/i.test(x.id));
  
  // Find forms
  const forms = ids.filter(x => /form/i.test(x.id));

  // Find buttons with onclick
  const buttonActions = [];
  const btnRegex = /<button[^>]*onclick=["']([^"']+)["'][^>]*>/g;
  lines.forEach((line, idx) => {
    let match;
    while ((match = btnRegex.exec(line)) !== null) {
      buttonActions.push({ action: match[1], line: idx + 1, text: line.trim().slice(0, 120) });
    }
  });

  return {
    totalLines: lines.length,
    totalIds: ids.length,
    views,
    tables,
    forms,
    buttonActionsCount: buttonActions.length,
    buttonActionsSample: buttonActions.slice(0, 20)
  };
}

const indexAnalysis = analyzeHtml('index.html');
const portalAnalysis = analyzeHtml('portal-baocao.html');

console.log('=== INDEX.HTML ===');
console.log('Lines:', indexAnalysis.totalLines);
console.log('Views & Modals:', JSON.stringify(indexAnalysis.views, null, 2));
console.log('Tables:', JSON.stringify(indexAnalysis.tables, null, 2));
console.log('Forms:', JSON.stringify(indexAnalysis.forms, null, 2));

console.log('\n=== PORTAL-BAOCAO.HTML ===');
console.log('Lines:', portalAnalysis.totalLines);
console.log('Views & Modals:', JSON.stringify(portalAnalysis.views, null, 2));
console.log('Tables:', JSON.stringify(portalAnalysis.tables, null, 2));
console.log('Forms:', JSON.stringify(portalAnalysis.forms, null, 2));

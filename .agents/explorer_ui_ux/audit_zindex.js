const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const portalHtml = fs.readFileSync('portal-baocao.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');

// 1. Check z-index hierarchy across all modals and overlays
console.log('=== Z-INDEX HIERARCHY AUDIT ===');
const zIndexRegex = /z-\[?([0-9]+)\]?/g;
const indexModals = [];
indexHtml.split('\n').forEach((l, i) => {
  if (l.includes('modal') || l.includes('overlay') || l.includes('toast') || l.includes('z-') || l.includes('z-[')) {
    const zm = l.match(/z-(?:\[([0-9]+)\]|([0-9]+))/);
    const idm = l.match(/id=["']([^"']+)["']/);
    if (zm || idm) {
      indexModals.push({ line: i+1, id: idm ? idm[1] : '', zIndex: zm ? (zm[1] || zm[2]) : 'none', text: l.trim().slice(0, 80) });
    }
  }
});
console.log(JSON.stringify(indexModals.filter(m => m.zIndex !== 'none'), null, 2));

// 2. Check z-index in portal-baocao.html
console.log('\n=== PORTAL Z-INDEX ===');
const portalModals = [];
portalHtml.split('\n').forEach((l, i) => {
  const zm = l.match(/z-(?:\[([0-9]+)\]|([0-9]+))/);
  const idm = l.match(/id=["']([^"']+)["']/);
  if (zm || idm) {
    portalModals.push({ line: i+1, id: idm ? idm[1] : '', zIndex: zm ? (zm[1] || zm[2]) : 'none' });
  }
});
console.log(JSON.stringify(portalModals.filter(m => m.zIndex !== 'none'), null, 2));

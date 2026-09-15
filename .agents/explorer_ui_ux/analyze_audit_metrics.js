const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit_metrics.json'), 'utf8'));

console.log('=== AUDIT METRICS SUMMARY ===');
console.log('Timestamp:', data.timestamp);

const report = {
  overflows: [],
  touchTargetViolations: [],
  contrastViolations: [],
  consoleLogs: []
};

for (const [vpName, vpData] of Object.entries(data.viewports)) {
  console.log(`\n--- Viewport: ${vpName} (${vpData.width}x${vpData.height}) ---`);
  
  // Console logs
  if (vpData.consoleLogs && vpData.consoleLogs.length > 0) {
    console.log(`Console logs count: ${vpData.consoleLogs.length}`);
    vpData.consoleLogs.forEach(l => {
      report.consoleLogs.push({ viewport: vpName, ...l });
    });
  }

  // Views
  for (const [viewName, viewMetrics] of Object.entries(vpData.views)) {
    if (!viewMetrics) continue;

    // Check page overflow
    if (viewMetrics.hasPageOverflow) {
      console.log(`[OVERFLOW] ${viewName} has page overflow! docScrollW=${viewMetrics.docScrollW}, clientW=${viewMetrics.clientW}`);
      report.overflows.push({
        viewport: vpName,
        view: viewName,
        docScrollW: viewMetrics.docScrollW,
        clientW: viewMetrics.clientW,
        diff: viewMetrics.docScrollW - viewMetrics.clientW,
        elements: viewMetrics.overflowElements
      });
    }

    // Touch targets
    if (viewMetrics.touchTargetViolations && viewMetrics.touchTargetViolations.length > 0) {
      viewMetrics.touchTargetViolations.forEach(t => {
        report.touchTargetViolations.push({
          viewport: vpName,
          view: viewName,
          ...t
        });
      });
    }

    // Contrast
    if (viewMetrics.textContrastFails && viewMetrics.textContrastFails.length > 0) {
      viewMetrics.textContrastFails.forEach(c => {
        report.contrastViolations.push({
          viewport: vpName,
          view: viewName,
          ...c
        });
      });
    }
  }
}

console.log('\n=== TOTAL DETECTED ISSUES ===');
console.log('Page Overflows detected:', report.overflows.length);
console.log('Total Touch Target Violations recorded:', report.touchTargetViolations.length);
console.log('Total Contrast Violations recorded:', report.contrastViolations.length);
console.log('Total Console Logs:', report.consoleLogs.length);

fs.writeFileSync(path.join(__dirname, 'analyzed_findings.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('Wrote analyzed_findings.json');

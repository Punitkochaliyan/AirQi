/**
 * Verification Script for SmogShield AI
 * Runs syntax checks, HTML landmark & ARIA verifications, and unit/stress benchmarks.
 */

const fs = require('fs');
const path = require('path');

console.log('=== VERIFYING SMOGSHIELD AI APPLICATION SUITE ===');

// 1. Verify files exist
const requiredFiles = [
  'index.html',
  'style.css',
  'app-core.js',
  'app.js',
  'app-core.d.ts',
  'package.json',
  'test-runner.js'
];
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING FILE: ${file}`);
    process.exit(1);
  }
  const size = fs.statSync(filePath).size;
  console.log(`✓ File present: ${file} (${size} bytes)`);
});

// 2. HTML Landmark & Accessibility Checks
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

const accessibilityChecks = [
  { desc: 'Skip to main content link', pattern: /<a[^>]*href="#main-content"/ },
  { desc: 'Main landmark with id="main-content"', pattern: /<main[^>]*id="main-content"/ },
  { desc: 'Header banner landmark', pattern: /<header[^>]*role="banner"/ },
  { desc: 'Footer contentinfo landmark', pattern: /<footer[^>]*role="contentinfo"/ },
  { desc: 'ARIA tablist for tracks', pattern: /role="tablist"/ },
  { desc: 'ARIA tabs with aria-selected and aria-controls', pattern: /role="tab"[^>]*aria-selected/ },
  { desc: 'ARIA tabpanel with aria-labelledby', pattern: /role="tabpanel"[^>]*aria-labelledby/ },
  { desc: 'ARIA range slider attributes', pattern: /aria-valuemin="0"[^>]*aria-valuemax="500"/ },
  { desc: 'ARIA live region on AI log', pattern: /role="log"[^>]*aria-live="polite"/ },
  { desc: 'ARIA dialog for test modal', pattern: /role="dialog"[^>]*aria-modal="true"/ },
  { desc: 'Run Checks button', pattern: /id="btn-run-checks"/ },
  { desc: 'Print Plan button', pattern: /id="btn-print-plan"/ },
  { desc: 'Comparison chart canvas', pattern: /<canvas id="exposure-chart"/ }
];

accessibilityChecks.forEach(check => {
  if (check.pattern.test(html)) {
    console.log(`✓ Accessibility check passed: ${check.desc}`);
  } else {
    console.error(`✗ Accessibility check failed: ${check.desc}`);
    process.exit(1);
  }
});

// 3. Security checks in HTML & JS
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
const appCoreJs = fs.readFileSync(path.join(__dirname, 'app-core.js'), 'utf-8');

if (appJs.includes('innerHTML = `<') || appCoreJs.includes('innerHTML = `<')) {
  console.error('✗ Detected dangerous unescaped template literal assignment to innerHTML!');
  process.exit(1);
} else {
  console.log('✓ Security check passed: No unescaped dynamic innerHTML template literal interpolations.');
}

if (appJs.includes('eval(') || appCoreJs.includes('eval(')) {
  console.error('✗ Detected eval() call!');
  process.exit(1);
} else {
  console.log('✓ Security check passed: Zero eval() usage.');
}

// 4. Run test-runner.js (which includes the 10,000-iteration stress test)
const { execSync } = require('child_process');
try {
  const testOutput = execSync('node test-runner.js', { encoding: 'utf-8' });
  console.log('\n--- Test-Runner Output ---');
  console.log(testOutput.trim());
  console.log('--------------------------\n');
} catch (err) {
  console.error('Error running test-runner:', err);
  process.exit(1);
}

console.log('ALL VERIFICATION CHECKS PASSED WITH ZERO ERRORS.');

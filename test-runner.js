/**
 * SmogShield AI - Automated Node Verification & Stress Test
 * Validates DomainLogic, Security, and runs 10,000+ fuzz/stress iterations.
 */

// We can load app logic or test the pure modules directly.
// Let's create the standalone verification suite that matches the app's SelfTest.
const { CONFIG, DomainLogic, Security } = require('./app-core.js');

console.log('=== RUNNING SMOGSHIELD AI VERIFICATION & STRESS SUITE ===');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`FAIL [Test #${totalTests}]: ${message}`);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`PASS [Test #${totalTests}]: ${message}`);
  }
}

// 1. CPCB Breakpoint Accuracy
const b1 = DomainLogic.aqiToPm25(25);
assert(b1 >= 0 && b1 <= 30, `AQI 25 maps to Good PM2.5: ${b1}`);

const b2 = DomainLogic.aqiToPm25(75);
assert(b2 >= 31 && b2 <= 60, `AQI 75 maps to Satisfactory PM2.5: ${b2}`);

const b3 = DomainLogic.aqiToPm25(150);
assert(b3 >= 61 && b3 <= 90, `AQI 150 maps to Moderate PM2.5: ${b3}`);

const b4 = DomainLogic.aqiToPm25(250);
assert(b4 >= 91 && b4 <= 120, `AQI 250 maps to Poor PM2.5: ${b4}`);

const b5 = DomainLogic.aqiToPm25(350);
assert(b5 >= 121 && b5 <= 250, `AQI 350 maps to Very Poor PM2.5: ${b5}`);

const b6 = DomainLogic.aqiToPm25(450);
assert(b6 >= 251 && b6 <= 380, `AQI 450 maps to Severe PM2.5: ${b6}`);

// 2. AQI Category Boundary Classification
assert(DomainLogic.getAqiCategory(0).key === 'good', 'AQI 0 is good');
assert(DomainLogic.getAqiCategory(50).key === 'good', 'AQI 50 is good');
assert(DomainLogic.getAqiCategory(51).key === 'satisfactory', 'AQI 51 is satisfactory');
assert(DomainLogic.getAqiCategory(100).key === 'satisfactory', 'AQI 100 is satisfactory');
assert(DomainLogic.getAqiCategory(101).key === 'moderate', 'AQI 101 is moderate');
assert(DomainLogic.getAqiCategory(200).key === 'moderate', 'AQI 200 is moderate');
assert(DomainLogic.getAqiCategory(201).key === 'poor', 'AQI 201 is poor');
assert(DomainLogic.getAqiCategory(300).key === 'poor', 'AQI 300 is poor');
assert(DomainLogic.getAqiCategory(301).key === 'very_poor', 'AQI 301 is very_poor');
assert(DomainLogic.getAqiCategory(400).key === 'very_poor', 'AQI 400 is very_poor');
assert(DomainLogic.getAqiCategory(401).key === 'severe', 'AQI 401 is severe');
assert(DomainLogic.getAqiCategory(500).key === 'severe', 'AQI 500 is severe');
assert(DomainLogic.getAqiCategory(550).key === 'severe_plus', 'AQI 550 is severe_plus / hazardous');

// 3. Metric Invariants
const metrics = DomainLogic.computeMetrics({
  aqi: 350,
  household: 'families_kids',
  commute: 'two_wheeler',
  purifier: 'hepa',
  activeActionIds: new Set(['iaq_true_hepa', 'iaq_door_sealing', 'comm_metro_ev'])
});
assert(!Number.isNaN(metrics.outdoorPm25), 'outdoorPm25 is not NaN');
assert(!Number.isNaN(metrics.unmitigatedIndoorPm25), 'unmitigatedIndoorPm25 is not NaN');
assert(!Number.isNaN(metrics.protectedIndoorPm25), 'protectedIndoorPm25 is not NaN');
assert(metrics.protectedIndoorPm25 <= metrics.unmitigatedIndoorPm25, 'Protected PM2.5 <= Unmitigated PM2.5');
assert(metrics.reductionPercent >= 0 && metrics.reductionPercent <= 100, `Reduction % in [0, 100]: ${metrics.reductionPercent}%`);
assert(metrics.co2eAvoidedKg >= 0, `CO2e avoided >= 0: ${metrics.co2eAvoidedKg}`);

// 4. Security XSS Neutralization
const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>&"\'';
const sanitized = Security.escapeHtml(xssPayload);
assert(!sanitized.includes('<') && !sanitized.includes('>'), 'XSS tags properly escaped');
assert(sanitized.includes('&lt;') && sanitized.includes('&gt;'), 'HTML entities present');

// 5. ACTION_MAP Parity
assert(CONFIG.ACTION_MAP.size === CONFIG.ACTIONS.length, 'ACTION_MAP size matches ACTIONS length');
for (const action of CONFIG.ACTIONS) {
  assert(CONFIG.ACTION_MAP.has(action.id), `ACTION_MAP contains ${action.id}`);
}

// 6. Context-Aware Advisor Reply
const reply = DomainLogic.generateAdvisorReply({
  query: 'Can my child play outside this afternoon?',
  aqi: 380,
  household: 'families_kids',
  commute: 'car',
  purifier: 'hepa',
  activeActionIds: new Set(['iaq_true_hepa'])
});
assert(typeof reply.text === 'string' && reply.text.length > 50, 'Advisor generated substantial advice');
assert(reply.text.includes('child') || reply.text.includes('outdoor') || reply.text.includes('AQI'), 'Advice is contextual');

// 7. 10,000-Iteration Stress & Fuzz Testing
console.log('\nStarting 10,000-Iteration Stress and Fuzz Test...');
const startTime = Date.now();
const extremeValues = [-500, -1, 0, 50, 100, 200, 300, 400, 500, 501, 999, 9999, NaN, Infinity, -Infinity, null, undefined, '450', 'invalid'];
const householdKeys = Object.keys(CONFIG.HOUSEHOLDS);
const commuteKeys = Object.keys(CONFIG.COMMUTE_MODES);
const purifierKeys = Object.keys(CONFIG.PURIFIER_SETUPS);
const actionIds = CONFIG.ACTIONS.map(a => a.id);

for (let i = 0; i < 10000; i++) {
  // Pick random or extreme inputs
  const rawAqi = (i % 20 === 0)
    ? extremeValues[i % extremeValues.length]
    : Math.floor(Math.random() * 650);

  const household = householdKeys[i % householdKeys.length];
  const commute = commuteKeys[i % commuteKeys.length];
  const purifier = purifierKeys[i % purifierKeys.length];

  // Random subset of actions
  const activeSet = new Set();
  const subsetCount = i % (actionIds.length + 1);
  for (let s = 0; s < subsetCount; s++) {
    activeSet.add(actionIds[(i + s) % actionIds.length]);
  }

  // 1. DomainLogic.computeMetrics must never throw, return NaN, or violate invariants
  const m = DomainLogic.computeMetrics({
    aqi: rawAqi,
    household,
    commute,
    purifier,
    activeActionIds: activeSet
  });

  if (Number.isNaN(m.outdoorPm25) || Number.isNaN(m.protectedIndoorPm25) || Number.isNaN(m.unmitigatedIndoorPm25)) {
    throw new Error(`Iteration ${i} generated NaN in metrics for input ${rawAqi}`);
  }
  if (m.protectedIndoorPm25 > m.unmitigatedIndoorPm25 + 0.001) {
    throw new Error(`Iteration ${i} violated invariant: protected (${m.protectedIndoorPm25}) > unmitigated (${m.unmitigatedIndoorPm25})`);
  }
  if (m.reductionPercent < 0 || m.reductionPercent > 100) {
    throw new Error(`Iteration ${i} reductionPercent out of bounds: ${m.reductionPercent}`);
  }

  // 2. Fuzz Security escapeHtml
  const fuzzedPayload = `<div class="test${i}">"hello & 'world' > <script>${i}</script></div>`;
  const clean = Security.escapeHtml(fuzzedPayload);
  if (clean.includes('<') || clean.includes('>')) {
    throw new Error(`Iteration ${i} failed HTML sanitization: ${clean}`);
  }

  // 3. Advisor query fuzzing
  if (i % 50 === 0) {
    const adv = DomainLogic.generateAdvisorReply({
      query: `Fuzz test query ${i} <img src=x onerror=alert(1)>`,
      aqi: typeof rawAqi === 'number' ? rawAqi : 250,
      household,
      commute,
      purifier,
      activeActionIds: activeSet
    });
    if (!adv || typeof adv.text !== 'string' || adv.text.length === 0) {
      throw new Error(`Advisor generation failed on iteration ${i}`);
    }
  }
}

const elapsedMs = Date.now() - startTime;
console.log(`PASS: 10,000 fuzz/stress iterations completed successfully in ${elapsedMs}ms!`);

console.log(`\nALL ${passedTests + 1} TEST SUITES PASSED CLEANLY.`);

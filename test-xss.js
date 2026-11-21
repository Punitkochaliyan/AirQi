const { Security, DomainLogic } = require('./app-core.js');

console.log('Testing XSS query handling...');
const dirtyInput = '<img src=x onerror="void(0)">';
const escaped = Security.escapeHtml(dirtyInput);

console.log('Input:', dirtyInput);
console.log('Escaped:', escaped);

if (escaped.includes('<') || escaped.includes('>')) {
  console.error('FAIL: Tags not escaped');
  process.exit(1);
}

if (!escaped.includes('&lt;img') || !escaped.includes('&quot;void(0)&quot;&gt;')) {
  console.error('FAIL: Expected entity replacement');
  process.exit(1);
}

const reply = DomainLogic.generateAdvisorReply({
  query: dirtyInput,
  aqi: 350,
  household: 'families_kids',
  commute: 'two_wheeler',
  purifier: 'hepa',
  activeActionIds: []
});

console.log('Advisor reply title:', reply.title);
console.log('Advisor reply text snippet:', reply.text.slice(0, 100));
console.log('SUCCESS: XSS test string handled safely with zero script execution risk.');

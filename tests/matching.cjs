const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

// Run the actual content-script matcher/classifier without needing a browser.
const source = fs.readFileSync(path.join(__dirname,'../content.js'),'utf8');
const context = vm.createContext({IntersectionObserver:class {}});
vm.runInContext(source.slice(0,source.indexOf('\nconst isReddit')),context);
function configure(goals,avoid) {
  vm.runInContext(`cfg = {learned:{}}; goalMatchers=compileEntries(${JSON.stringify(goals)}); avoidMatchers=compileEntries(${JSON.stringify(avoid)});`,context);
}
function classify(text) {return vm.runInContext(`classify(${JSON.stringify(text)})`,context)}
const matches = ['AI','ai','Ai',' AI ','Use AI today','AI, today','(AI)','AI.','AI-powered','#AI','AI\nresearch','AI\ttools'];
const nonmatches = ['said','paid','chair','mail','training','rain','OpenAI','AItools','toolsAI','_AI','AI_','AI2','2AI','éAI','AIé','AI\u0301','AI\u203ftools','AI\u200dtools'];
configure('','AI');
for(const text of matches) {
  const result=classify(text);
  assert.equal(result.state,'red',`Should match standalone AI: ${text}`);
  assert.deepEqual(Array.from(result.neg),['ai']);
}
for(const text of nonmatches) assert.equal(classify(text).state,'gray',`Must not match part of a word: ${text}`);
configure('AI','');
for(const text of matches) assert.equal(classify(text).state,'green',`Goal should match: ${text}`);
for(const text of nonmatches) assert.equal(classify(text).state,'gray',`Goal must not match substring: ${text}`);
configure('','system design, C++, a.b');
for(const text of ['System   design','system\ndesign','Learn C++ today','Use a.b today']) assert.equal(classify(text).state,'red',text);
for(const text of ['ecosystem design','system designer','system and design','Use axb today','C++Builder']) assert.equal(classify(text).state,'gray',text);
console.log('Matching checks passed: standalone short keywords, substring exclusions, punctuation, case, Unicode word boundaries, phrases and literal special characters for goals and avoided topics.');

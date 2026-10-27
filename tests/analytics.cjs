const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'analytics.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'dashboard-model.js'), 'utf8'), ctx);
vm.runInContext(`
let data = {};
const now = new Date(2026, 9, 26, 12);
const event = {id: '123', state: 'red', hidden: true, reasons: ['celebrity gossip', 'celebrity gossip']};
data = recordEvent(data, event, now);
data = recordEvent(data, event, now);
let totals = summarize(data, 1, 15, now);
if (totals.seen !== 1 || totals.hidden !== 1 || totals.saved !== 15 || totals.reasons.get('celebrity gossip') !== 1) throw Error('Deduplication failed');
data = recordEvent(data, {...event, hidden: false, reveal: true}, now);
totals = summarize(data, 1, 15, now);
if (totals.hidden !== 1 || totals.revealed !== 1 || totals.saved !== 0) throw Error('Reveal accounting failed');
const fastReveal = recordEvent({}, {...event, hidden: false, everHidden: true, reveal: true}, now);
if (summarize(fastReveal, 1, 15, now).hidden !== 1 || summarize(fastReveal, 1, 15, now).saved !== 0) throw Error('Batched fast reveal failed');
data = recordEvent(data, {...event, id: '456'}, now);
data = recordEvent(data, {...event, id: '789', state: 'gray', reasons: ['No goal match (strict mode)']}, now);
totals = summarize(data, 1, 30, now);
if (totals.hidden !== 3 || totals.saved !== 60 || totals.seen !== 3) throw Error('Estimate or strict-mode count failed');
data = recordEvent(data, {...event, id: '456', state: 'green', hidden: false}, now);
if (summarize(data, 1, 30, now).saved !== 30) throw Error('Unhidden post included in estimate');
const snapshot = JSON.stringify(data);
recordEvent(data, {...event, id: '../invalid'}, now);
if (JSON.stringify(data) !== snapshot) throw Error('Invalid ID accepted');
data.days['2026-09-01'] = {};
data = recordEvent(data, {...event, id: '111'}, now);
if (data.days['2026-09-01']) throw Error('Retention failed');
data = recordEvent(data, event, new Date(2026, 9, 27, 12));
if (summarize(data, 1, 15, new Date(2026, 9, 27, 12)).seen !== 1) throw Error('Day separation failed');
if (summarize(data, 7, 15, new Date(2026, 9, 27, 12)).seen !== 5) throw Error('Range failed');
if (duration(0) !== '0 sec' || duration(75) !== '1 min 15 sec' || duration(3660) !== '1 hr 1 min') throw Error('Duration failed');
if (validSeconds(Infinity) !== 15 || validSeconds(999) !== 300) throw Error('Estimate validation failed');
`, ctx);
vm.runInContext(`
const crossPlatform = {};
recordEvent(crossPlatform, {id:'123',state:'red',hidden:true}, now);
recordEvent(crossPlatform, {id:'reddit:t3_123',state:'green'}, now);
recordEvent(crossPlatform, {id:'reddit:t3_abc',state:'red',hidden:true}, now);
recordEvent(crossPlatform, {id:'reddit:t3_abc',state:'red',hidden:true}, now);
if (summarize(crossPlatform,1,15,now).seen !== 3) throw Error('Platform IDs collided or Reddit deduplication failed');
const crossSnapshot = JSON.stringify(crossPlatform);
for (const id of ['reddit:t1_abc','reddit:t3_../bad','reddit:t3_','__proto__',123]) recordEvent(crossPlatform,{id,state:'red'},now);
if(JSON.stringify(crossPlatform)!==crossSnapshot) throw Error('Invalid platform ID accepted');
`, ctx);
(async () => {
  let listener, stored = {}, writes = 0;
  const worker = vm.createContext({setTimeout, importScripts() {}, chrome: {
    runtime: {onMessage: {addListener(fn) {listener = fn;}}},
    storage: {local: {async get() { await new Promise(r => setTimeout(r, 2)); return structuredClone(stored); }, async set(value) {writes++; stored = structuredClone(value);}}}
  }});
  vm.runInContext(fs.readFileSync(path.join(root, 'analytics.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'background.js'), 'utf8'), worker);
  await Promise.all(Array.from({length: 20}, (_, i) => new Promise(resolve => listener({type: 'post-observed', event: {id: String(i), state: 'red', hidden: true, reasons: ['test']}}, {tab: {}, url: 'https://x.com/home'}, resolve))));
  assert.equal(Object.values(stored.analytics.days)[0] && Object.keys(Object.values(stored.analytics.days)[0]).length, 20);
  assert.equal(writes, 1, 'Concurrent events should share a storage write');
  await Promise.all(['www','old','new'].map((host,i) => new Promise(resolve => listener({type:'post-observed',event:{id:`reddit:t3_${i}`,state:'red',hidden:true}}, {tab:{},url:`https://${host}.reddit.com/r/test/`},resolve))));
  assert.equal(Object.keys(Object.values(stored.analytics.days)[0]).length,23);
  assert.equal(listener({type:'posts-observed',events:[]},{tab:{},url:'https://www.reddit.com.attacker.test/'},()=>{}),undefined);
  assert.equal(listener({type:'posts-observed',events:[]},{tab:{},url:'https://unrelated.example/'},()=>{}),undefined);
  console.log('Analytics checks passed: deduplication, reveals, estimates, reasons, dates, retention, validation, and 20 concurrent events.');
})().catch(error => {console.error(error); process.exitCode = 1;});



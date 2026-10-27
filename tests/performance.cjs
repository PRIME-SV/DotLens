const {chromium} = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const results=[];
  for (const script of ['tests/content-before.js','content.js']) {
   const page=await browser.newPage({viewport:{width:1000,height:800}});
   await page.route('https://x.com/**', route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body><aside id="ticker"></aside>'+Array.from({length:60},(_,i)=>`<article data-testid="tweet" style="height:150px"><a href="/author/status/${i+1}"><time>Today</time></a><div data-testid="tweetText">A machine learning tutorial ${i}</div></article>`).join('')+'</body>'}));
   await page.goto('https://x.com/home');
   await page.evaluate(()=>{
    window.counts={scans:0,layoutReads:0,messages:0};
    const query=document.querySelectorAll.bind(document);
    document.querySelectorAll=(selector)=>{if(selector==='article[data-testid="tweet"]')counts.scans++;return query(selector)};
    const inner=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'innerText');
    Object.defineProperty(HTMLElement.prototype,'innerText',{get(){counts.layoutReads++;return inner.get.call(this)},set:inner.set});
    window.chrome={storage:{sync:{async get(){return{goals:'machine learning',avoid:'',blurMode:'red'}}},local:{async get(){return{learned:{}}},async set(){}},onChanged:{addListener(){}}},runtime:{async sendMessage(){counts.messages++;return{ok:true}}}};
   });
   await page.addScriptTag({path:path.resolve(script)});
   await page.waitForFunction(()=>document.querySelectorAll('.dl-dot').length===60);
   await page.waitForTimeout(600);
   const before=await page.evaluate(()=>({...counts}));
   for(let i=0;i<8;i++) {await page.evaluate(i=>{document.getElementById('ticker').replaceChildren(document.createTextNode(String(i)))},i);await page.waitForTimeout(350)}
   const after=await page.evaluate(()=>({...counts}));
   for(let i=0;i<4;i++){await page.evaluate(()=>scrollTo(0,650));await page.waitForTimeout(250);await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(250)}
   const final=await page.evaluate(()=>({...counts}));
   results.push({script,unrelatedUpdateScans:after.scans-before.scans,unrelatedLayoutReads:after.layoutReads-before.layoutReads,scrollMessages:final.messages-after.messages});
   if(script==='content.js') {
    assert.equal(after.scans-before.scans,0);
    assert.equal(final.layoutReads,0);
    assert.ok(final.messages-after.messages<=2);
    await page.evaluate(()=>{document.querySelector('[data-testid="tweetText"]').firstChild.data='Changed text';});
    await page.waitForFunction(()=>document.querySelector('.dl-dot').classList.contains('dl-gray'));
   }
   await page.close();
  }
  console.log(JSON.stringify(results,null,2));
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});

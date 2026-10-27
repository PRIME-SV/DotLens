const {chromium} = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
(async () => {
 const browser = await chromium.launch({channel: 'msedge', headless: true});
 try {
  const context = await browser.newContext();
  const errors = [], stores = {sync: {activeProfileId:'1', focusProfile1:{name:'Work',goals:'AI',avoid:'gossip',blurMode:'red'},focusProfile2:{name:'Personal',goals:'travel',avoid:'politics',blurMode:'red'}},local:{enabled:true,secondsPerPost:15}};
  let failNextSave = false;
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.exposeBinding('storageGet', (_, area) => structuredClone(stores[area]));
  async function setStorage(area, values) {
   if (failNextSave && area === 'sync' && (values.focusProfile1 || values.focusProfile2)) { failNextSave = false; throw Error('Simulated storage failure'); }
   const changes = Object.fromEntries(Object.entries(values).map(([key,newValue])=>[key,{oldValue:stores[area][key],newValue}]));
   Object.assign(stores[area],values);
   await Promise.all(context.pages().map(page=>page.evaluate(({changes,area})=>window.storageListeners.forEach(fn=>fn(changes,area)),{changes,area})));
  }
  await context.exposeBinding('storageSet', (_,area,values)=>setStorage(area,values));
  await context.addInitScript(()=>{
   window.storageListeners=[];
   window.chrome={storage:{onChanged:{addListener(fn){window.storageListeners.push(fn)}},...Object.fromEntries(['sync','local'].map(area=>[area,{get:()=>window.storageGet(area),set:values=>window.storageSet(area,values)}]))},runtime:{openOptionsPage(){window.opened=true}}};
  });
  const page = await context.newPage();
  const url = pathToFileURL(path.join(root,'options.html')).href;
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('#profile').disabled);
  assert.equal(await page.locator('#onboarding').isVisible(),true);
  assert.equal(await page.locator('#activity-panels').isVisible(),false);
  await page.screenshot({path:path.join(root,'tests/ux-onboarding.png'),fullPage:true});
  await page.locator('#setup-link').click();
  await page.waitForFunction(()=>!document.querySelector('#preferences-view').hidden);
  await page.locator('#goals').fill('Unsaved work topics');
  assert.equal(await page.locator('#draft-badge').textContent(),'Unsaved edits');
  const popup = await context.newPage();
  await popup.setViewportSize({width:360,height:400});
  await popup.goto(pathToFileURL(path.join(root,'popup.html')).href);
  await popup.waitForFunction(()=>!document.querySelector('#profile').disabled);
  await popup.locator('#profile').selectOption('2');
  await page.waitForFunction(()=>document.querySelector('#profile-name').value==='Personal');
  await page.locator('#avoid').fill('Unsaved personal topics');
  await popup.locator('#profile').selectOption('1');
  await page.waitForFunction(()=>document.querySelector('#goals').value==='Unsaved work topics');
  assert.equal(stores.sync.focusProfile1.goals,'AI');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#goals').value==='Unsaved work topics');
  await page.locator('#profile').selectOption('2');
  await page.waitForFunction(()=>document.querySelector('#avoid').value==='Unsaved personal topics');
  assert.equal(stores.sync.focusProfile2.avoid,'politics');
  await page.locator('#discard').click();
  await page.waitForFunction(()=>document.querySelector('#avoid').value==='politics');
  assert.equal(await page.locator('#draft-badge').textContent(),'Saved');
  await page.locator('#profile').selectOption('1');
  await page.waitForFunction(()=>document.querySelector('#goals').value==='Unsaved work topics');
  failNextSave = true;
  await page.locator('#save').click();
  await page.waitForFunction(()=>document.querySelector('#msg').textContent.startsWith('Could not finish'));
  assert.equal(await page.locator('#goals').inputValue(),'Unsaved work topics');
  assert.equal(await page.locator('#save').isEnabled(),true);
  await page.locator('#save').click();
  await page.waitForFunction(()=>document.querySelector('#msg').textContent.startsWith('Saved.'));
  assert.equal(stores.sync.focusProfile1.goals,'Unsaved work topics');
  assert.equal(await page.locator('#draft-badge').textContent(),'Saved');
  // Invalid estimate expands its disclosure and prevents saving the profile.
  await page.locator('#goals').fill('Newer work topics');
  await page.locator('.estimate-settings summary').click();
  await page.locator('#seconds').fill('0');
  await page.locator('.estimate-settings summary').click();
  await page.locator('#save').click();
  assert.equal(await page.locator('.estimate-settings').evaluate(el=>el.open),true);
  assert.equal(stores.sync.focusProfile1.goals,'Unsaved work topics');
  await page.locator('#seconds').fill('30');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#goals').value==='Newer work topics');
  assert.equal(await page.locator('#seconds').inputValue(),'30');
  await page.locator('#discard').click();
  await page.waitForFunction(()=>document.querySelector('#draft-badge').textContent==='Saved');
  assert.equal(await page.locator('#seconds').inputValue(),'15');
  // Both switch locations update the dashboard pause state.
  await popup.locator('#enabled').uncheck();
  await page.waitForFunction(()=>!document.querySelector('#paused').hidden);
  assert.equal(await page.locator('#enabled').isChecked(),false);
  await page.locator('#enabled').check();
  await popup.waitForFunction(()=>document.querySelector('#enabled').checked);
  assert.equal(await page.locator('#paused').isVisible(),false);
  await page.locator('#feedback summary').click();
  assert.equal(await page.locator('#feedback details').evaluate(el=>el.open),true);
  await page.locator('#dismiss-feedback').click();
  assert.equal(stores.local.feedbackDismissed,true);
  await page.reload();
  await page.waitForFunction(()=>!document.querySelector('#profile').disabled);
  assert.equal(await page.locator('#feedback').isVisible(),false);
  // Populate a week's observations and check both views at laptop and narrow widths.
  const days = {};
  for(let n=0;n<7;n++) {const d=new Date();d.setDate(d.getDate()-n);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;days[key]=Object.fromEntries(Array.from({length:48},(_,i)=>[i,{state:i<30?'red':'green',hidden:i<30,everHidden:i<30,revealed:i===0,reasons:i%2?['gossip']:['politics']}]))}
  await setStorage('local',{analytics:{started:Object.keys(days).at(-1),days}});
  await page.locator('aside .nav[href="#overview"]').click();
  await page.waitForFunction(()=>!document.querySelector('#overview-view').hidden);
  assert.equal(await page.locator('#saved').textContent(),'50m 45s');
  assert.equal(await page.locator('#onboarding').isVisible(),false);
  const oldDate=new Date();oldDate.setDate(oldDate.getDate()-10);
  const oldKey=oldDate.toLocaleDateString('en-CA');
  await setStorage('local',{analytics:{days:{[oldKey]:{one:{hidden:true,everHidden:true}}}}});
  await page.locator('#range').selectOption('1');
  assert.equal(await page.locator('#empty').isVisible(),true);
  assert.equal(await page.locator('#onboarding').isVisible(),false);
  await setStorage('local',{analytics:{days}});
  await page.locator('#range').selectOption('7');
  const measurements=[];
  for(const [width,height] of [[1366,650],[1280,600],[1024,650],[390,844]]) {
   await page.setViewportSize({width,height});
   for(const view of ['overview','preferences']) {
    await page.evaluate(view=>{location.hash=view==='preferences'?'#preferences':'#overview'},view);
    await page.waitForFunction(view=>document.querySelector('#preferences-view').hidden===(view!=='preferences'),view);
    const result = await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth,profileInView:document.querySelector('#profile').getBoundingClientRect().bottom<innerHeight,navVisible:[...document.querySelectorAll('.nav')].some(el=>el.getBoundingClientRect().height>0),durationFits:document.querySelector('#saved').scrollWidth<=document.querySelector('#saved').clientWidth}));
    assert.equal(result.horizontalOverflow,false,`${width} ${view} horizontal overflow`);
    assert.equal(result.profileInView,true);
    assert.equal(result.navVisible,true);
    if(view==='overview')assert.equal(result.durationFits,true);
    measurements.push({width,height,view,...result});
    await page.evaluate(()=>window.scrollTo(0,0));
    if(width===1366||width===390)await page.screenshot({path:path.join(root,`tests/ux-${view}-${width}.png`),fullPage:true});
   }
  }
  await popup.reload();await popup.waitForFunction(()=>!document.querySelector('#profile').disabled);
  assert.equal(await popup.locator('#saved').textContent(),'7m 15s');
  assert.equal(await popup.locator('.scope').textContent(),'All profiles');
  await popup.keyboard.press('Tab');assert.equal(await popup.evaluate(()=>document.activeElement.id),'enabled');
  await popup.keyboard.press('Space');await popup.waitForFunction(()=>document.querySelector('#enabled-label').textContent==='Off');
  assert.equal(await popup.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
  await popup.screenshot({path:path.join(root,'tests/ux-popup.png'),fullPage:true});
  // Essential and supporting text contrast against the rendered background.
  const contrasts=await page.evaluate(()=>{
   const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   return ['.muted','.form-help','small','.footnote','.chart-date','.primary'].map(selector=>{
    const el=document.querySelector(selector);let bgEl=el;while(bgEl&&getComputedStyle(bgEl).backgroundColor==='rgba(0, 0, 0, 0)')bgEl=bgEl.parentElement;
    const rgb=text=>text.match(/[\d.]+/g).map(Number);
    const a=luminance(rgb(getComputedStyle(el).color)),b=luminance(rgb(getComputedStyle(bgEl||document.documentElement).backgroundColor));
    return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   });
  });
  for(const result of contrasts)assert.ok(result.ratio>=4.5,JSON.stringify(result));
  assert.deepEqual(errors,[]);
  console.log('PASS: profile drafts survive external/internal switching and reloads; explicit save/discard; save failure recovery; estimate validation; two-way filtering controls; onboarding; persistent feedback dismissal; compact durations; laptop/narrow layouts; popup keyboard and height; text contrast.');
  console.log(JSON.stringify({measurements,contrasts},null,2));
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

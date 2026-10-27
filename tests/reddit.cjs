const {chromium} = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
const extensionRoot = path.resolve(__dirname,'..');
const assert = require('node:assert/strict');

// Synthetic DOM fixtures: no Reddit account, content API, or browsing history.
const modern = `<!doctype html><style>shreddit-post{display:block;height:220px;margin-bottom:8px}</style>
<shreddit-post id="t3_123" post-title="Celebrity gossip today"><a slot="title" href="/r/test/comments/123/example/">Celebrity gossip today</a><div slot="text-body"><p>Entertainment news</p></div></shreddit-post>
<shreddit-post id="t3_abc" post-title="A system design guide"><h1 slot="title">A system design guide</h1><div slot="text-body"><p>Database architecture</p></div></shreddit-post>
<shreddit-comment thingid="t1_def"><div slot="comment">Celebrity gossip in a comment</div></shreddit-comment>
<script>customElements.define('shreddit-post',class extends HTMLElement{connectedCallback(){if(!this.shadowRoot)this.attachShadow({mode:'open'}).innerHTML='<slot name="title"></slot><slot name="text-body"></slot>';}});</script>`;

async function open(browser, url, body) {
  const page = await browser.newPage({viewport:{width:1000,height:1000}});
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.route('https://**/*', route => route.fulfill({contentType:'text/html',body}));
  await page.goto(url);
  await page.evaluate(() => {
    window.settings = {goals:'system design, AI',avoid:'celebrity gossip',blurMode:'red'};
    window.local = {learned:{}};
    window.reports = [];
    window.listeners = [];
    window.chrome = {
      storage:{sync:{async get(){return settings}},local:{async get(){return local},async set(value){Object.assign(local,value)}},onChanged:{addListener(fn){listeners.push(fn)}}},
      runtime:{async sendMessage(message){reports.push(...message.events);return{ok:true}}}
    };
  });
  await page.addStyleTag({path:path.join(extensionRoot, 'content.css')});
  await page.addScriptTag({path:path.join(extensionRoot, 'content.js')});
  return page;
}

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await open(browser,'https://www.reddit.com/r/test/',modern);
    await page.waitForFunction(() => reports.some(x => x.id==='reddit:t3_123') && reports.some(x => x.id==='reddit:t3_abc'));
    assert.equal(await page.locator('.dl-dot').count(),2);
    assert.equal(await page.locator('shreddit-comment .dl-dot').count(),0);
    assert.equal(await page.locator('.dl-veil').count(),1);
    assert.equal(await page.locator('shreddit-post').first().evaluate(el => !!el.shadowRoot.querySelector('.dl-veil')),true);
    assert.equal(await page.locator('.dl-veil').evaluate(el => getComputedStyle(el).position),'absolute');
    assert.equal(await page.locator('.dl-veil').evaluate(el => getComputedStyle(el).backgroundColor),'rgb(245, 247, 246)');
    await page.screenshot({path:'tests/reddit-modern.png',fullPage:true});
    await page.locator('shreddit-post').first().evaluate(el => {
      el.shadowRoot.innerHTML='<slot name="title"></slot><slot name="text-body"></slot>';
    });
    await page.waitForFunction(() => document.querySelector('shreddit-post').shadowRoot.querySelector('.dl-veil'));
    await page.locator('.dl-veil button').click();
    await page.waitForFunction(() => reports.some(x => x.id==='reddit:t3_123' && x.reveal && !x.hidden));
    // Reveal carries over to a second rendering of the same post.
    await page.evaluate(() => document.body.appendChild(document.querySelector('shreddit-post').cloneNode(true)));
    await page.waitForFunction(() => [...document.querySelectorAll('shreddit-post')].every(el => el.shadowRoot.querySelector('.dl-dot')));
    assert.equal(await page.locator('.dl-veil').count(),0);
    // Recycled card + edited text + hydrated title attributes.
    await page.locator('shreddit-post').nth(1).evaluate(el => {
      el.id='t3_xyz';el.setAttribute('post-title','Celebrity gossip');
      el.querySelector('h1').textContent='Celebrity gossip';
      el.querySelector('[slot="text-body"]').replaceChildren();
    });
    await page.waitForFunction(() => reports.some(x => x.id==='reddit:t3_xyz' && x.hidden));
    await page.locator('shreddit-post').nth(1).evaluate(el => {
      el.setAttribute('post-title','A system design guide');
      el.querySelector('h1').firstChild.data='A system design guide';
    });
    await page.waitForFunction(() => reports.some(x => x.id==='reddit:t3_xyz' && x.state==='green' && !x.hidden));
    // Titles and bodies only: a comment or engagement label is not post text.
    await page.evaluate(() => {
      const post=document.createElement('shreddit-post');
      post.id='t3_clean';post.innerHTML='<h3 slot="title">Ordinary topic</h3><span>celebrity gossip</span><shreddit-comment><p>celebrity gossip</p></shreddit-comment>';
      document.body.prepend(post);
    });
    await page.waitForFunction(() => reports.some(x => x.id==='reddit:t3_clean' && x.state==='gray'));
    // Strict mode and dots-only propagate through the shared settings listener.
    await page.evaluate(() => {settings.blurMode='nongreen';listeners.forEach(fn=>fn({blurMode:{}},'sync'))});
    await page.waitForFunction(() => document.querySelector('#t3_clean').shadowRoot.querySelector('.dl-veil'));
    await page.evaluate(() => {settings.blurMode='off';listeners.forEach(fn=>fn({blurMode:{}},'sync'))});
    await page.waitForFunction(() => [...document.querySelectorAll('shreddit-post')].every(el => !el.shadowRoot.querySelector('.dl-veil')));
    // Manual correction still updates local learning and analytics.
    await page.locator('#t3_clean .dl-dot').click();
    await page.waitForFunction(() => reports.some(x => x.id==='reddit:t3_clean' && x.state==='green'));
    assert.ok(await page.evaluate(() => local.learned.ordinary > 0));
    const reportCount=await page.evaluate(() => reports.length);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => reports.length),reportCount,'Controls must not trigger a mutation/report loop');
    assert.equal(await page.evaluate(() => reports.some(x => Object.hasOwn(x,'text'))),false);
    await page.locator('#t3_clean').evaluate(el => el.removeAttribute('id'));
    await page.waitForFunction(() => ![...document.querySelectorAll('shreddit-post')].find(el => el.querySelector('h3'))?.shadowRoot.querySelector('.dl-dot'));
    assert.deepEqual(page.errors,[]);
    await page.close();

    const old = await open(browser,'https://old.reddit.com/r/test/comments/123/thread/',`<!doctype html>
      <div class="thing link" data-fullname="t3_123" style="height:200px"><div class="entry"><a class="title" href="/r/test/comments/123/thread/">Neutral title</a><div class="expando"><div class="usertext-body"><div class="md">Celebrity gossip</div></div></div></div><div class="thing comment"><div class="md">system design</div></div></div>
      <div class="thing link" data-fullname="t3_abc" style="height:200px"><div class="entry"><a class="title">A system design guide</a></div></div>`);
    await old.waitForFunction(() => reports.length>=2);
    assert.equal(await old.locator('.dl-veil').count(),1);
    assert.equal(await old.locator('.thing.comment .dl-dot').count(),0);
    assert.equal(await old.evaluate(() => reports.find(x => x.id==='reddit:t3_123').state),'red');
    await old.screenshot({path:'tests/reddit-old.png',fullPage:true});
    assert.deepEqual(old.errors,[]);
    await old.close();

    const legacy = await open(browser,'https://new.reddit.com/r/test/',`<!doctype html>
      <article data-testid="post-container" style="height:200px"><a href="/r/test/comments/base36/example/"><h3>System design guide</h3></a></article>
      <article data-testid="post-container" style="height:200px"><a href="/r/test/comments/base37/example/"><h3>Celebrity gossip</h3></a></article>`);
    await legacy.waitForFunction(() => reports.length>=2);
    assert.equal(await legacy.locator('.dl-dot').count(),2);
    assert.equal(await legacy.locator('.dl-veil').count(),1);
    assert.equal(await legacy.evaluate(() => reports[0].id),'reddit:t3_base36');
    assert.deepEqual(legacy.errors,[]);
    await legacy.close();
    const boundary = await open(browser,'https://www.reddit.com/r/test/',
      '<!doctype html><style>shreddit-post{display:block;height:120px}</style>' +
      ['AI tools','I paid for email','OpenAI update','A chair in the rain','(AI), research'].map((title,i) =>
        `<shreddit-post id="t3_word${i}"><h3 slot="title">${title}</h3></shreddit-post>`).join(''));
    await boundary.waitForFunction(() => document.querySelectorAll('.dl-dot').length===5);
    await boundary.evaluate(() => {settings.goals='';settings.avoid='AI';listeners.forEach(fn=>fn({goals:{},avoid:{}},'sync'))});
    await boundary.waitForFunction(() => document.querySelectorAll('.dl-veil').length===2);
    for(const i of [1,2,3]) {
      assert.equal(await boundary.locator(`#t3_word${i} .dl-dot.dl-gray`).count(),1);
      assert.equal(await boundary.locator(`#t3_word${i} .dl-veil`).count(),0);
    }
    assert.deepEqual(boundary.errors,[]);
    await boundary.close();
    // A body wrapper can contain comments/notices after Reddit hydration. They
    // must be excluded before collecting text, not just when selecting roots.
    const isolation = await open(browser,'https://www.reddit.com/r/IndianStockMarket/comments/1xd849x/example/',`<!doctype html>
      <style>shreddit-post,article,.thing.link{display:block;min-height:100px}</style>
      <shreddit-post id="t3_1xd849x" post-title="Unable to bear loss..kindly suggest what to do">
        <h1 slot="title">Unable to bear loss..kindly suggest what to do</h1>
        <div slot="text-body"><p>My investment portfolio.</p>
          <shreddit-comment author="AutoModerator"><div slot="comment"><p>Guidelines - Buy/Sell, AI Slops, One-liner and Portfolio Review posts will be removed.</p></div></shreddit-comment>
          <div data-testid="moderator-announcement"><h3>AI announcement</h3></div>
          <div class="commentarea"><div class="md">AI comments</div></div>
          <aside><h3>AI community rules</h3></aside>
        </div>
        <h3>AI in an unrelated heading</h3><span slot="credit-bar">AI author</span>
      </shreddit-post>
      <article data-testid="post-container" id="legacy-isolation"><a href="/r/test/comments/legacyclean/example/"><h3>Neutral post</h3></a><div data-testid="post-content"><p>A portfolio question.</p><div data-testid="comment"><h3>AI comment</h3></div><div data-testid="mod-notice">AI rules</div></div></article>
      <div class="thing link" data-fullname="t3_oldclean"><div class="entry"><a class="title">Neutral old post</a><div class="expando"><div class="usertext-body"><div class="md">Portfolio question.<div class="thing comment"><div class="md">AI comment</div></div></div></div></div></div></div>
      <shreddit-comment><div slot="comment">AI outside the post</div></shreddit-comment>
      <script>customElements.define('shreddit-post',class extends HTMLElement{connectedCallback(){this.attachShadow({mode:'open'}).innerHTML='<slot name="title"></slot><slot name="text-body"></slot>';}})</script>`);
    await isolation.waitForFunction(() => document.querySelectorAll('[data-dl="1"]').length===3);
    await isolation.evaluate(() => {settings.goals='';settings.avoid='AI';listeners.forEach(fn=>fn({goals:{},avoid:{}},'sync'))});
    await isolation.waitForFunction(() => document.querySelector('#t3_1xd849x').shadowRoot.querySelector('.dl-dot.dl-gray') && document.querySelector('#legacy-isolation .dl-dot.dl-gray') && document.querySelector('.thing.link .dl-dot.dl-gray'));
    assert.equal(await isolation.locator('.dl-veil').count(),0,'Comments/notices must not hide the post');
    assert.equal(await isolation.locator('#t3_1xd849x').evaluate(el => /\bAI\b/i.test(readPost(el).text)),false);
    // Comment-only edits stay irrelevant.
    await isolation.locator('shreddit-comment').first().evaluate(el => el.querySelector('p').textContent='AI AI AI changed comment');
    assert.equal(await isolation.locator('.dl-veil').count(),0);
    // Editing the author's real body or title must still trigger the filter.
    await isolation.locator('#t3_1xd849x [slot="text-body"] > p').evaluate(el => el.textContent='I use AI to research companies.');
    await isolation.waitForFunction(() => document.querySelector('#t3_1xd849x').shadowRoot.querySelector('.dl-veil'));
    await isolation.locator('#t3_1xd849x [slot="text-body"] > p').evaluate(el => el.textContent='My investment portfolio.');
    await isolation.waitForFunction(() => !document.querySelector('#t3_1xd849x').shadowRoot.querySelector('.dl-veil'));
    await isolation.locator('#t3_1xd849x').evaluate(el => {el.setAttribute('post-title','AI investing');el.querySelector('h1').textContent='AI investing'});
    await isolation.waitForFunction(() => document.querySelector('#t3_1xd849x').shadowRoot.querySelector('.dl-veil'));
    await isolation.locator('#t3_1xd849x .dl-dot').click(); // red -> gray
    await isolation.locator('#t3_1xd849x .dl-dot').click(); // gray -> green, learn post words only
    assert.equal(await isolation.evaluate(() => Object.hasOwn(local.learned,'guidelines') || Object.hasOwn(local.learned,'comment') || Object.hasOwn(local.learned,'announcement')),false);
    assert.deepEqual(isolation.errors,[]);
    await isolation.close();
    console.log('Reddit browser checks passed: modern shadow DOM, classic/legacy posts, titles/body isolation, dynamic cards, reveals, shared modes, corrections, local-only events and stable mutation handling.');
  } finally {await browser.close()}
})().catch(error => {console.error(error);process.exitCode=1});

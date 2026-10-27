const STOP = new Set("this that with have from they will your about what when there their been were just like more than into some very also only over them then here make".split(" "));
let cfg = { goals: "", avoid: "", learned: {}, blurMode: "red" };
const revealed = new Set();   // platform-specific post IDs the user chose to view
const tracked = new WeakMap();
const reported = new Map();
let goalMatchers = [], avoidMatchers = [];
function report(el, reveal = false) {
  const post = tracked.get(el);
  if (!post?.visible) return;
  const hidden = Boolean(controlsRoot(el).querySelector('.dl-veil'));
  const reasons = post.state === 'red' ? post.result.neg : ['No goal match (strict mode)'];
  post.everHidden ||= hidden;
  post.revealed ||= reveal;
  if (hidden) post.hideReasons = reasons.length ? reasons : ['Manual correction'];
  const event = {
    id: post.id, state: post.state, hidden, reveal: Boolean(post.revealed),
    everHidden: Boolean(post.everHidden), reasons: post.hideReasons || []
  };
  const date = new Date();
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}:${post.id}`;
  const signature = JSON.stringify(event);
  if (reported.get(key) === signature) return;
  reported.set(key, signature);
  if (reported.size > 2000) reported.delete(reported.keys().next().value);
  queueReport(key, signature, event);
}
const pendingReports = new Map();
let reportTimer;
function queueReport(key, signature, event) {
  pendingReports.set(key, {key, signature, event});
  if (!reportTimer) reportTimer = setTimeout(flushReports, 150);
}
async function flushReports() {
  reportTimer = null;
  const batch = [...pendingReports.values()];
  pendingReports.clear();
  try {
    const result = await chrome.runtime.sendMessage({type: 'posts-observed', events: batch.map(item => item.event)});
    if (!result?.ok) throw Error('Analytics write failed');
  } catch {
    for (const item of batch) if (reported.get(item.key) === item.signature) reported.delete(item.key);
  }
}
const visibility = new IntersectionObserver(items => {
  for (const item of items) {
    const post = tracked.get(item.target);
    if (post && item.isIntersecting) { post.visible = true; report(item.target); }
  }
}, {threshold: 0.1});
const words = t => (t.toLowerCase().match(/[a-z0-9#]{4,}/g) || []).filter(w => !STOP.has(w));
const uniq = a => [...new Set(a)];
// Each comma-separated entry or line is a literal keyword, phrase, or sentence.
const entries = t => uniq(t.split(/[,\r\n]+/).map(s => s.trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean));
const escapeRegex = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compileEntries(value) {
  // Require complete words, including Unicode combining marks/connectors.
  // Spaces, punctuation and line breaks delimit words; "paid"/"OpenAI" do not.
  const wordCharacter = '[\\p{L}\\p{M}\\p{N}\\p{Pc}\\u200C\\u200D]';
  return entries(value).map(entry => ({entry, regex: new RegExp(`(?<!${wordCharacter})${entry.split(/\s+/).map(escapeRegex).join('\\s+')}(?!${wordCharacter})`, 'iu')}));
}

function classify(text) {
  let s = 0; const pos = [], neg = [];
  for (const {entry, regex} of goalMatchers) {
    if (regex.test(text)) { s += 2; pos.push(entry); }
  }
  for (const {entry, regex} of avoidMatchers) {
    if (regex.test(text)) { s -= 2; neg.push(entry); }
  }
  for (const w of uniq(words(text))) {
    const l = cfg.learned[w] || 0;
    if (l > 0) pos.push(w); if (l < 0) neg.push(w);
    s += l;
  }
  const state = s >= 2 ? "green" : s <= -2 ? "red" : "gray";
  return { state, pos: uniq(pos), neg: uniq(neg) };
}

const isReddit = /^(?:www\.|old\.|new\.)?reddit\.com$/.test(location.hostname);
const postSelector = isReddit
  ? 'shreddit-post, article[data-testid="post-container"], .thing.link[data-fullname]'
  : 'article[data-testid="tweet"]';
const redditExcludedSelector = 'shreddit-comment, shreddit-comment-tree, shreddit-async-loader[comment-id], .thing.comment, .commentarea, [slot="comment"], [slot="comments"], [data-testid="comment"], [data-testid="comment-tree"], [data-testid="moderator-announcement"], [data-testid="moderator-notice"], [data-testid="mod-notice"], [slot="mod-announcement"], [slot="post-mod-note"], shreddit-post-removed-banner, [slot="credit-bar"], [data-testid="post-meta"], [data-testid="post-flair"], [slot="post-flair"], [data-post-click-location="author"], [data-post-click-location="subreddit"], .dl-dot, .dl-veil, aside, nav, button, script, style, template, noscript';
function ownedPostSection(node, post) {
  return node.closest(postSelector) === post && !node.closest(redditExcludedSelector);
}
function redditSectionText(section, post) {
  // Never read a wrapper's textContent: comments and moderation UI may be
  // nested inside it. Prune those subtrees before visiting any text nodes.
  const visit = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.matches(redditExcludedSelector) || (node !== post && node.matches(postSelector))) return '\n';
    const text = [...node.childNodes].map(visit).join('');
    return /^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE|BR)$/.test(node.tagName) ? `\n${text}\n` : text;
  };
  return visit(section).trim();
}
function redditPostText(post) {
  const modern = post.tagName === 'SHREDDIT-POST';
  const classic = post.matches('.thing.link');
  const titleSelector = modern ? '[slot="title"], [id^="post-title"]' : classic ? 'a.title' : 'h1, h3';
  const bodySelector = modern
    ? '[slot="text-body"], [data-post-click-location="text-body"], [id$="-post-rtjson-content"]'
    : classic ? '.expando .usertext-body .md' : '[data-testid="post-content"], [data-click-id="text"]';
  const titleNode = [...post.querySelectorAll(titleSelector)].find(node => ownedPostSection(node, post));
  const title = modern && post.hasAttribute('post-title') ? post.getAttribute('post-title') : titleNode ? redditSectionText(titleNode, post) : '';
  const sections = [...post.querySelectorAll(bodySelector)].filter(node => ownedPostSection(node, post));
  const bodies = sections.filter(node => !sections.some(parent => parent !== node && parent.contains(node)));
  return [title, ...bodies.map(node => redditSectionText(node, post))].filter(Boolean).join('\n');
}
function readPost(el) {
  if (!isReddit) {
    const a = el.querySelector('a[href*="/status/"] time')?.closest('a');
    return {id: a?.getAttribute('href').match(/\/status\/(\d+)/)?.[1], text: el.querySelector('[data-testid="tweetText"]')?.textContent || ''};
  }
  // Older containers can wrap a modern post. Never classify/count both.
  if (el.tagName !== 'SHREDDIT-POST' && el.querySelector('shreddit-post')) return {};
  const fullname = el.getAttribute('id') || '';
  const raw = el.getAttribute('data-fullname') || (fullname.startsWith('t3_') ? fullname : '');
  const permalink = el.getAttribute('permalink') || el.getAttribute('content-href') || el.getAttribute('data-permalink') || el.querySelector('a[href*="/comments/"]')?.getAttribute('href') || '';
  const postId = raw.match(/^t3_([a-z0-9]+)$/i)?.[1] || permalink.match(/\/comments\/([a-z0-9]+)(?:\/|$|[?#])/i)?.[1];
  return {id: postId ? `reddit:t3_${postId.toLowerCase()}` : null, text: redditPostText(el)};
}

function controlsRoot(el) { return el.shadowRoot || el; }
const observedRoots = new WeakSet();
function prepareControls(el) {
  const root = controlsRoot(el);
  // Reddit renders cards using web components. Keep controls inside their open
  // shadow root so unslotted light-DOM children cannot disappear.
  if (root !== el && !root.querySelector('style[data-dl-style]')) {
    const style = document.createElement('style');
    style.dataset.dlStyle = '1';
    style.textContent = `
      .dl-dot{position:absolute;top:8px;right:8px;width:14px;height:14px;padding:0;border-radius:50%;z-index:10;cursor:pointer;border:2px solid #fff;box-shadow:0 0 0 1px #555}
      .dl-green{background:#22c55e}.dl-red{background:#ef4444}.dl-gray{background:#9ca3af}
      .dl-veil{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:12px;font:14px system-ui,sans-serif;color:#111;background:#f5f7f6;overflow:auto}
      .dl-veil button{cursor:pointer;border:1px solid currentColor;border-radius:999px;padding:6px 16px;background:transparent;color:inherit;font:inherit}
      @media(prefers-color-scheme:dark){.dl-veil{color:#eee;background:#17201d}}
    `;
    root.appendChild(style);
  }
  if (root !== el && !observedRoots.has(root)) {
    observedRoots.add(root);
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === Node.ELEMENT_NODE && !node.matches('.dl-dot, .dl-veil, style[data-dl-style]')))) enqueue(el);
    }).observe(root, {childList:true});
  }
  return root;
}

const shouldBlur = state => cfg.blurMode === "nongreen" ? state !== "green" : cfg.blurMode === "red" ? state === "red" : false;
const quote = ws => ws.slice(0, 3).map(w => `“${w}”`).join(", ");

function reasonFor(state, r) {
  if (state === "red") return r.neg.length ? `Matches what you avoid: ${quote(r.neg)}` : "You marked similar posts as not useful";
  return "No match with your goals";
}

function applyVeil(el, id, state, r) {
  const root = controlsRoot(el);
  root.querySelector(".dl-veil")?.remove();
  if (!shouldBlur(state) || revealed.has(id)) return;
  const veil = document.createElement("div");
  veil.className = "dl-veil";
  veil.innerHTML = `<b>Hidden by DotLens</b><span></span><button type="button">Let me view it</button>`;
  veil.querySelector("span").textContent = reasonFor(state, r);
  const stop = e => { e.stopPropagation(); e.preventDefault(); };
  veil.addEventListener("click", stop);
  veil.querySelector("button").addEventListener("click", e => { stop(e); revealed.add(id); veil.remove(); report(el, true); });
  root.appendChild(veil);
}

function process(el, force = false) {
  if (!el.isConnected) return;
  const {id, text} = readPost(el);
  const previous = tracked.get(el);
  if (!id) {
    if (previous) {
      visibility.unobserve(el);
      previous.root.querySelector('.dl-dot')?.remove();
      previous.root.querySelector('.dl-veil')?.remove();
      tracked.delete(el);
      delete el.dataset.dl;
    }
    return;
  }
  const root = controlsRoot(el);
  if (!force && previous?.id === id && previous.text === text && previous.root === root && root.querySelector('.dl-dot')) return;
  if (previous) { visibility.unobserve(el); previous.root.querySelector('.dl-dot')?.remove(); previous.root.querySelector('.dl-veil')?.remove(); }
  el.dataset.dl = "1";
  prepareControls(el);
  let r = classify(text), state = r.state;
  tracked.set(el, {id, text, state, result: r, visible: false, root});
  const dot = document.createElement("button");
  dot.type = 'button';
  dot.className = `dl-dot dl-${state}`;
  dot.title = "Click to correct: green / red / gray";
  dot.setAttribute('aria-label', `Post classified ${state}. Click to correct.`);
  root.appendChild(dot);
  applyVeil(el, id, state, r);
  visibility.observe(el);
  dot.addEventListener("click", e => {
    e.stopPropagation(); e.preventDefault();
    const next = { green: "red", red: "gray", gray: "green" }[state];
    const learn = next === "green" ? 1 : next === "red" ? -1 : 0;
    if (learn) {
      for (const w of new Set(words(text))) cfg.learned[w] = Math.max(-3, Math.min(3, (cfg.learned[w] || 0) + learn));
      chrome.storage.local.set({ learned: cfg.learned });
    }
    state = next;
    tracked.get(el).state = state;
    tracked.get(el).result = {pos: [], neg: []};
    dot.className = `dl-dot dl-${state}`;
    dot.setAttribute('aria-label', `Post classified ${state}. Click to correct.`);
    applyVeil(el, id, state, { pos: [], neg: [] });
    report(el);
  });
}

const candidates = new Map();
let workScheduled = false;
function enqueue(el, force = false) {
  candidates.set(el, force || candidates.get(el) || false);
  if (!workScheduled) {
    workScheduled = true;
    if ('requestIdleCallback' in window) requestIdleCallback(runWork, {timeout: 150});
    else setTimeout(runWork, 16);
  }
}
function runWork() {
  workScheduled = false;
  const start = performance.now();
  for (const [el, force] of candidates) {
    candidates.delete(el);
    process(el, force);
    if (performance.now() - start >= 6) break;
  }
  if (candidates.size) enqueue(candidates.keys().next().value);
}
function discover(node) {
  if (node.nodeType !== Node.ELEMENT_NODE || node.closest('.dl-dot, .dl-veil')) return;
  if (node.matches(postSelector)) enqueue(node);
  else {
    const post = node.closest(postSelector);
    if (post) enqueue(post);
    else node.querySelectorAll(postSelector).forEach(el => enqueue(el));
  }
}
const scan = (force = false) => document.querySelectorAll(postSelector).forEach(el => enqueue(el, force));
let pendingNodes = new Set();
let mutationRaf = 0;
function drainMutations() {
  mutationRaf = 0;
  const nodes = pendingNodes;
  pendingNodes = new Set();
  for (const node of nodes) {
    if (node.isConnected) discover(node);
  }
}
new MutationObserver(records => {
  for (const record of records) {
    const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
    if (!target || target.closest('.dl-dot, .dl-veil, style[data-dl-style]')) continue;
    if (record.type === 'childList') {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !node.matches('.dl-dot, .dl-veil, style[data-dl-style]')) pendingNodes.add(node);
      }
    }
    // Character edits, removed body text and reused cards must reclassify too.
    if (record.type !== 'childList' || [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && !node.matches('.dl-dot, .dl-veil, style[data-dl-style]')))) {
      const post = target.closest(postSelector);
      if (post) pendingNodes.add(post);
    }
  }
  if (pendingNodes.size && !mutationRaf) mutationRaf = requestAnimationFrame(drainMutations);
}).observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'id', 'data-fullname', 'data-permalink', 'permalink', 'content-href', 'post-title']});
if (isReddit && window.customElements) customElements.whenDefined('shreddit-post').then(() => requestAnimationFrame(() => scan(true)));

async function load(force = true) {
  const s = await chrome.storage.sync.get(["goals", "avoid", "blurMode"]);
  const l = await chrome.storage.local.get("learned");
  cfg = { goals: s.goals || "", avoid: s.avoid || "", learned: l.learned || {}, blurMode: s.blurMode || "red" };
  goalMatchers = compileEntries(cfg.goals);
  avoidMatchers = compileEntries(cfg.avoid);
  scan(force);
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && ['goals', 'avoid', 'blurMode'].some(key => key in changes)) load(true);
  else if (area === 'local' && 'learned' in changes) load(false);
});
load();

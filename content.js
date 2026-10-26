const STOP = new Set("this that with have from they will your about what when there their been were just like more than into some very also only over them then here make".split(" "));
let cfg = { goals: "", avoid: "", learned: {}, blurMode: "red" };
const revealed = new Set();   // tweet ids the user chose to view
const tracked = new WeakMap();
const reported = new Map();
let goalMatchers = [], avoidMatchers = [];
function report(el, reveal = false) {
  const post = tracked.get(el);
  if (!post?.visible) return;
  const hidden = Boolean(el.querySelector('.dl-veil'));
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
  return entries(value).map(entry => ({entry, regex: new RegExp(`(?:^|[^\\p{L}\\p{N}_])${entry.split(/\s+/).map(escapeRegex).join('\\s+')}(?=$|[^\\p{L}\\p{N}_])`, 'iu')}));
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

function tweetId(el) {
  const time = el.querySelector('a[href*="/status/"] time');
  const a = time?.closest('a');
  return a ? a.getAttribute("href").match(/\/status\/(\d+)/)?.[1] : null;
}

const shouldBlur = state => cfg.blurMode === "nongreen" ? state !== "green" : cfg.blurMode === "red" ? state === "red" : false;
const quote = ws => ws.slice(0, 3).map(w => `“${w}”`).join(", ");

function reasonFor(state, r) {
  if (state === "red") return r.neg.length ? `Matches what you avoid: ${quote(r.neg)}` : "You marked similar posts as not useful";
  return "No match with your goals";
}

function applyVeil(el, id, state, r) {
  el.querySelector(".dl-veil")?.remove();
  if (!shouldBlur(state) || revealed.has(id)) return;
  const veil = document.createElement("div");
  veil.className = "dl-veil";
  veil.innerHTML = `<b>Hidden by DotLens</b><span></span><button type="button">Let me view it</button>`;
  veil.querySelector("span").textContent = reasonFor(state, r);
  const stop = e => { e.stopPropagation(); e.preventDefault(); };
  veil.addEventListener("click", stop);
  veil.querySelector("button").addEventListener("click", e => { stop(e); revealed.add(id); veil.remove(); report(el, true); });
  el.appendChild(veil);
}

function process(el, force = false) {
  if (!el.isConnected) return;
  const id = tweetId(el), textEl = el.querySelector('[data-testid="tweetText"]');
  if (!id) return;
  const text = textEl ? textEl.textContent : "";
  const previous = tracked.get(el);
  if (!force && previous?.id === id && previous.text === text) return;
  if (previous) { visibility.unobserve(el); el.querySelector('.dl-dot')?.remove(); el.querySelector('.dl-veil')?.remove(); }
  el.dataset.dl = "1";
  let r = classify(text), state = r.state;
  tracked.set(el, {id, text, state, result: r, visible: false});
  const dot = document.createElement("div");
  dot.className = `dl-dot dl-${state}`;
  dot.title = "Click to correct: green / red / gray";
  el.appendChild(dot);
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
    applyVeil(el, id, state, { pos: [], neg: [] });
    report(el);
  });
}

const postSelector = 'article[data-testid="tweet"]';
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
    for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) pendingNodes.add(node);
    }
  }
  if (pendingNodes.size && !mutationRaf) mutationRaf = requestAnimationFrame(drainMutations);
}).observe(document.body, {childList: true, subtree: true});

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

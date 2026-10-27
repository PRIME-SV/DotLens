const STOP = new Set("this that with have from they will your about what when there their been were just like more than into some very also only over them then here make".split(" "));
let cfg = { goals: "", avoid: "", learned: {}, blurMode: "red" };
const revealed = new Set();   // tweet ids the user chose to view
const tracked = new WeakMap();
function report(el, reveal = false) {
  const post = tracked.get(el);
  if (!post?.visible) return;
  const hidden = Boolean(el.querySelector('.dl-veil'));
  const reasons = post.state === 'red' ? post.result.neg : ['No goal match (strict mode)'];
  chrome.runtime.sendMessage({type: 'post-observed', event: {
    id: post.id, state: post.state, hidden, reveal,
    reasons: reasons.length ? reasons : ['Manual correction']
  }}).catch(() => {});
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
function matchesEntry(text, entry) {
  const pattern = entry.split(/\s+/).map(escapeRegex).join("\\s+");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${pattern}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(text);
}

function classify(text) {
  let s = 0; const pos = [], neg = [];
  for (const entry of entries(cfg.goals)) {
    if (matchesEntry(text, entry)) { s += 2; pos.push(entry); }
  }
  for (const entry of entries(cfg.avoid)) {
    if (matchesEntry(text, entry)) { s -= 2; neg.push(entry); }
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
  const a = [...el.querySelectorAll('a[href*="/status/"]')].find(x => x.querySelector("time"));
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

function process(el) {
  const id = tweetId(el), textEl = el.querySelector('[data-testid="tweetText"]');
  if (!id) return;
  const text = textEl ? textEl.innerText : "";
  const previous = tracked.get(el);
  if (previous?.id === id && previous.text === text) return;
  if (previous) { visibility.unobserve(el); el.querySelector('.dl-dot')?.remove(); el.querySelector('.dl-veil')?.remove(); }
  el.dataset.dl = "1";
  el.style.position = "relative";
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

const scan = () => document.querySelectorAll('article[data-testid="tweet"]').forEach(process);
let timer;
new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 300); })
  .observe(document.body, { childList: true, subtree: true });

async function load() {
  const s = await chrome.storage.sync.get(["goals", "avoid", "blurMode"]);
  const l = await chrome.storage.local.get("learned");
  cfg = { goals: s.goals || "", avoid: s.avoid || "", learned: l.learned || {}, blurMode: s.blurMode || "red" };
  scan();
}
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' && ['goals', 'avoid', 'blurMode'].some(key => key in changes)) || (area === 'local' && 'learned' in changes)) load();
});
load();

const $ = id => document.getElementById(id);
let analytics = {}, secondsPerPost = 15;
function render() {
  const range = Number($('range').value);
  const totals = summarize(analytics, range, secondsPerPost);
  $('hidden').textContent = totals.hidden.toLocaleString();
  $('saved').textContent = duration(totals.saved);
  $('rate').textContent = `${totals.seen ? Math.round(100 * totals.hidden / totals.seen) : 0}%`;
  $('seen').textContent = totals.seen.toLocaleString();
  $('revealed').textContent = totals.revealed.toLocaleString();
  $('estimate-note').textContent = `${secondsPerPost} sec per post still hidden and never revealed`;
  $('empty').hidden = totals.seen > 0;
  $('started').textContent = analytics.started ? `Started ${analytics.started}` : 'Tracking starts with this update';
  const chart = $('chart'); chart.replaceChildren();
  const max = Math.max(1, ...totals.series.map(day => day.hidden));
  const format = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric'});
  for (const [index, day] of totals.series.entries()) {
    const col = document.createElement('div'); col.className = 'chart-col';
    col.title = `${format.format(day.date)}: ${day.hidden} posts hidden`;
    const count = document.createElement('span'); count.className = 'chart-count'; count.textContent = day.hidden || '';
    const bar = document.createElement('div'); bar.className = `bar${day.key === dayKey() ? ' today' : ''}`; bar.style.height = `${day.hidden / max * 135}px`;
    const label = document.createElement('span'); label.className = 'chart-date'; label.textContent = range <= 7 || index % 5 === 0 || index === range - 1 ? format.format(day.date) : '';
    col.append(count, bar, label); chart.append(col);
  }
  chart.setAttribute('aria-label', totals.series.map(day => `${format.format(day.date)}: ${day.hidden} hidden`).join('; '));
  const reasons = [...totals.reasons].sort((a, b) => b[1] - a[1]);
  $('reason-total').textContent = `${reasons.reduce((sum, [, n]) => sum + n, 0)} matches`;
  $('reasons').replaceChildren();
  if (!reasons.length) {
    const empty = document.createElement('p'); empty.className = 'empty-copy'; empty.textContent = 'Nothing filtered yet. Your matching words and phrases will appear here.'; $('reasons').append(empty);
  }
  for (const [term, count] of reasons) {
    const row = document.createElement('div'); row.className = 'reason';
    const title = document.createElement('div'); title.className = 'reason-title';
    const name = document.createElement('span'); name.textContent = term;
    const number = document.createElement('span'); number.textContent = `${count} ${count === 1 ? 'post' : 'posts'}`;
    title.append(name, number);
    const track = document.createElement('div'); track.className = 'track';
    const fill = document.createElement('div'); fill.className = 'fill'; fill.style.width = `${count / Math.max(1, totals.hidden) * 100}%`;
    track.append(fill); row.append(title, track); $('reasons').append(row);
  }
}
$('range').addEventListener('change', render);
$('save').addEventListener('click', async () => {
  if (!$('seconds').reportValidity()) return;
  const button = $('save'); button.disabled = true; $('msg').textContent = '';
  try {
    const nextSeconds = validSeconds($('seconds').value);
    await chrome.storage.sync.set({goals: $('goals').value, avoid: $('avoid').value, blurMode: $('blurMode').value});
    await chrome.storage.local.set({secondsPerPost: nextSeconds});
    secondsPerPost = nextSeconds; render(); $('msg').textContent = 'Saved. Refresh X to apply your filter.';
  } catch { $('msg').textContent = 'Could not save. Please try again.'; }
  finally { button.disabled = false; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.analytics) analytics = changes.analytics.newValue || {};
  if (changes.secondsPerPost) secondsPerPost = validSeconds(changes.secondsPerPost.newValue ?? 15);
  render();
});
(async () => {
  try {
    const [settings, local] = await Promise.all([chrome.storage.sync.get(['goals', 'avoid', 'blurMode']), chrome.storage.local.get(['analytics', 'secondsPerPost'])]);
    $('goals').value = settings.goals || ''; $('avoid').value = settings.avoid || ''; $('blurMode').value = settings.blurMode || 'red';
    analytics = local.analytics || {}; secondsPerPost = validSeconds(local.secondsPerPost ?? 15); $('seconds').value = secondsPerPost; render();
  } catch { $('error').textContent = 'Could not load your dashboard. Reload the extension and try again.'; }
})();

// Keep the sidebar selection in sync with anchor navigation and browser history.
function updateNavigation() {
  const section = location.hash === '#preferences' ? '#preferences' : '#overview';
  document.querySelectorAll('.nav').forEach(link => {
    const active = link.getAttribute('href') === section;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', updateNavigation);
updateNavigation();
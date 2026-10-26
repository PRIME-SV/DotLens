document.getElementById('opt').addEventListener('click', () => chrome.runtime.openOptionsPage());
async function renderPopup() {
  try {
    const {analytics = {}, secondsPerPost = 15} = await chrome.storage.local.get(['analytics', 'secondsPerPost']);
    const totals = summarize(analytics, 1, secondsPerPost);
    document.getElementById('hidden').textContent = totals.hidden.toLocaleString();
    document.getElementById('saved').textContent = duration(totals.saved);
    document.getElementById('out').textContent = `${totals.seen} encountered · ${totals.revealed} revealed`;
    document.getElementById('note').textContent = `Estimated at ${validSeconds(secondsPerPost)} sec per post still hidden and never revealed. Analytics stay local.`;
  } catch { document.getElementById('out').textContent = 'Unable to load analytics. Try reopening DotLens.'; }
}
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.analytics || changes.secondsPerPost)) renderPopup(); });
renderPopup();

document.getElementById('opt').addEventListener('click', () => chrome.runtime.openOptionsPage());
async function renderPopup() {
  try {
    const {analytics = {}, secondsPerPost = 15} = await chrome.storage.local.get(['analytics', 'secondsPerPost']);
    const totals = summarize(analytics, 1, secondsPerPost);
    document.getElementById('hidden').textContent = totals.hidden.toLocaleString();
    const saved = document.getElementById('saved');
    const fullDuration = duration(totals.saved);
    saved.textContent = compactDuration(totals.saved);
    saved.setAttribute('aria-label', fullDuration);
    saved.title = fullDuration;
    document.getElementById('out').textContent = `${totals.seen} encountered · ${totals.revealed} revealed`;
    document.getElementById('note').textContent = `Estimate: ${validSeconds(secondsPerPost)}s per hidden, unrevealed post. Stored locally.`;
  } catch { document.getElementById('out').textContent = 'Unable to load analytics. Try reopening DotLens.'; }
}
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.analytics || changes.secondsPerPost)) renderPopup(); });
renderPopup();

async function renderControls() {
  const state = await DotLensSettings.load();
  for (const id of ['1', '2']) document.querySelector('#profile option[value="' + id + '"]').textContent = state.profiles[id].name;
  document.getElementById('profile').value = state.activeId;
  document.getElementById('profile').title = state.profiles[state.activeId].name;
  document.getElementById('enabled').checked = state.enabled;
  document.getElementById('enabled-label').textContent = state.enabled ? 'On' : 'Off';
  document.getElementById('enabled').disabled = false;
  document.getElementById('profile').disabled = false;
}
for (const id of ['enabled', 'profile']) document.getElementById(id).addEventListener('change', async () => {
  const enabled = document.getElementById('enabled'), profile = document.getElementById('profile');
  enabled.disabled = profile.disabled = true;
  try {
    if (id === 'enabled') await chrome.storage.local.set({enabled: enabled.checked});
    else await DotLensSettings.activate(profile.value);
    document.getElementById('control-status').textContent = 'Applied to open X tabs.';
  } catch { document.getElementById('control-status').textContent = 'Could not save. Please try again.'; }
  finally { await renderControls().catch(controlError); }
});
function controlError() { document.getElementById('control-status').textContent = 'Could not load controls. Reopen DotLens to retry.'; }
chrome.storage.onChanged.addListener((changes, area) => {
  if (DotLensSettings.relevant(changes, area)) renderControls().catch(controlError);
});
renderControls().catch(controlError);

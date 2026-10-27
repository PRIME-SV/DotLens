const $ = id => document.getElementById(id);
let analytics = {}, secondsPerPost = 15;
let activeProfileId = '1', settingsState, formReady = false, busy = false, loadVersion = 0;
const drafts = new Map();
const fields = ['profile-name', 'goals', 'avoid', 'blurMode'];
const draftKey = id => 'dotlens-draft-' + id;
function sessionRead(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
function sessionWrite(key, value) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); }
  catch { $('error').textContent = 'Drafts are kept while this page is open, but could not be stored for reloads.'; }
}
for (const id of ['1', '2']) {
  try {
    const draft = JSON.parse(sessionRead(draftKey(id)));
    if (draft && ['name', 'goals', 'avoid', 'blurMode'].every(key => typeof draft[key] === 'string')) drafts.set(id, draft);
  } catch { /* Ignore invalid session drafts and load the saved profile. */ }
}
const profileValue = () => ({name: $('profile-name').value, goals: $('goals').value, avoid: $('avoid').value, blurMode: $('blurMode').value});
function updateDirty() {
  const dirty = drafts.has(activeProfileId) || Number($('seconds').value) !== secondsPerPost;
  $('draft-badge').textContent = dirty ? 'Unsaved edits' : 'Saved';
  $('draft-badge').classList.toggle('unsaved', dirty);
  $('discard').disabled = busy || !formReady || !dirty;
}
function rememberDraft() {
  if (!formReady || !settingsState) return;
  const value = profileValue();
  if (JSON.stringify(value) === JSON.stringify(settingsState.profiles[activeProfileId])) {
    drafts.delete(activeProfileId); sessionWrite(draftKey(activeProfileId), null);
  } else {
    drafts.set(activeProfileId, value); sessionWrite(draftKey(activeProfileId), JSON.stringify(value));
  }
  updateDirty();
}
function setBusy(value) {
  busy = value; if (value) ++loadVersion;
  $('profile').disabled = value || !formReady;
  $('enabled').disabled = value || !settingsState;
  $('profile-fields').disabled = value || !formReady;
  $('seconds').disabled = value || !formReady;
  $('save').disabled = value || !formReady;
  updateDirty();
}
async function loadProfiles() {
  rememberDraft();
  const version = ++loadVersion;
  const state = await DotLensSettings.load();
  if (version !== loadVersion) return;
  settingsState = state; activeProfileId = state.activeId;
  for (const id of ['1', '2']) $('profile').querySelector('[value="' + id + '"]').textContent = state.profiles[id].name;
  $('profile').value = activeProfileId;
  $('profile').title = state.profiles[activeProfileId].name;
  const profile = drafts.get(activeProfileId) || state.profiles[activeProfileId];
  $('profile-name').value = profile.name; $('goals').value = profile.goals;
  $('avoid').value = profile.avoid; $('blurMode').value = profile.blurMode;
  $('settings-title').textContent = 'Edit ' + state.profiles[activeProfileId].name;
  $('enabled').checked = state.enabled; $('enabled').disabled = false;
  $('enabled-label').textContent = state.enabled ? 'Filtering on' : 'Filtering off';
  $('paused').hidden = state.enabled;
  formReady = true; setBusy(busy); render();
}
for (const id of fields) $(id).addEventListener('input', () => { rememberDraft(); $('msg').textContent = ''; });
$('seconds').addEventListener('input', () => { sessionWrite('dotlens-seconds-draft', $('seconds').value); updateDirty(); $('msg').textContent = ''; });
$('profile').addEventListener('change', async () => {
  const nextId = $('profile').value;
  rememberDraft(); setBusy(true);
  try {
    await DotLensSettings.activate(nextId);
    await loadProfiles();
    $('control-status').textContent = 'Profile switched. Saved rules applied; unsaved edits are kept in this tab.';
    $('msg').textContent = '';
  } catch { $('profile').value = activeProfileId; $('control-status').textContent = 'Could not switch profiles. Your edits are kept. Please try again.'; }
  finally { setBusy(false); }
});
$('enabled').addEventListener('change', async () => {
  const enabled = $('enabled').checked; rememberDraft(); setBusy(true);
  try {
    await chrome.storage.local.set({enabled});
    await loadProfiles();
    $('control-status').textContent = enabled ? 'Filtering resumed using your saved rules.' : 'Filtering paused on this device.';
  } catch { $('enabled').checked = settingsState?.enabled ?? true; $('control-status').textContent = 'Could not change filtering. Please try again.'; }
  finally { setBusy(false); }
});
function render() {
  const range = Number($('range').value);
  const totals = summarize(analytics, range, secondsPerPost);
  $('hidden').textContent = totals.hidden.toLocaleString();
  $('saved').textContent = compactDuration(totals.saved);
  $('saved').setAttribute('aria-label', duration(totals.saved));
  $('saved').title = duration(totals.saved);
  $('rate').textContent = `${totals.seen ? Math.round(100 * totals.hidden / totals.seen) : 0}%`;
  $('seen').textContent = totals.seen.toLocaleString();
  $('revealed').textContent = totals.revealed.toLocaleString();
  $('estimate-note').textContent = `${secondsPerPost}s per unrevealed hidden post`;
  const firstVisit = !Object.values(analytics.days || {}).some(posts => Object.keys(posts).length > 0);
  $('onboarding').hidden = !firstVisit;
  $('overview').hidden = firstVisit;
  $('activity-heading').hidden = firstVisit;
  $('empty').hidden = firstVisit || totals.seen > 0;
  $('activity-panels').hidden = totals.seen === 0;
  const configured = settingsState && Boolean(settingsState.profiles[activeProfileId].goals.trim() || settingsState.profiles[activeProfileId].avoid.trim());
  $('setup-link').textContent = configured ? 'Review profile →' : 'Set up profile →';
  $('started').textContent = analytics.started ? `Started ${analytics.started}` : 'No activity yet';
  const chart = $('chart'); chart.replaceChildren();
  const max = Math.max(1, ...totals.series.map(day => day.hidden));
  const format = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric'});
  for (const [index, day] of totals.series.entries()) {
    const col = document.createElement('div'); col.className = 'chart-col';
    col.title = `${format.format(day.date)}: ${day.hidden} posts hidden`;
    const count = document.createElement('span'); count.className = 'chart-count'; count.textContent = (range <= 7 || index % 5 === 0) ? day.hidden || '' : '';
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
  if (!$('seconds').checkValidity()) { $('seconds').closest('details').open = true; $('seconds').reportValidity(); return; }
  rememberDraft();
  const id = activeProfileId, value = profileValue(), nextSeconds = validSeconds($('seconds').value);
  setBusy(true); $('msg').textContent = 'Saving…';
  try {
    await DotLensSettings.save(id, value);
    await chrome.storage.local.set({secondsPerPost: nextSeconds});
    drafts.delete(id); sessionWrite(draftKey(id), null); sessionWrite('dotlens-seconds-draft', null);
    secondsPerPost = nextSeconds; $('seconds').value = nextSeconds;
    formReady = false;
    await loadProfiles();
    $('msg').textContent = 'Saved. ' + (settingsState.enabled ? 'Rules applied to open X tabs.' : 'Turn filtering on above to apply your rules.');
  } catch { $('msg').textContent = 'Could not finish saving. Your edits are kept. Please try again.'; }
  finally { setBusy(false); }
});
$('discard').addEventListener('click', async () => {
  drafts.delete(activeProfileId); sessionWrite(draftKey(activeProfileId), null); sessionWrite('dotlens-seconds-draft', null);
  $('seconds').value = secondsPerPost; formReady = false; setBusy(true);
  try { await loadProfiles(); $('msg').textContent = 'Edits discarded. Saved preferences restored.'; }
  catch { $('error').textContent = 'Could not reload saved preferences. Please reload the page.'; }
  finally { setBusy(false); }
});
$('dismiss-feedback').addEventListener('click', async () => {
  try { await chrome.storage.local.set({feedbackDismissed: true}); $('feedback').hidden = true; }
  catch { $('control-status').textContent = 'Could not dismiss feedback. Please try again.'; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (DotLensSettings.relevant(changes, area) && !busy) {
    const switched = area === 'sync' && changes.activeProfileId;
    loadProfiles().then(() => {
      if (switched) $('control-status').textContent = 'Active profile updated. Unsaved edits are kept in this tab.';
    }).catch(() => { $('error').textContent = 'Could not update profile controls. Please reload.'; });
  }
  if (area !== 'local') return;
  if (changes.analytics) analytics = changes.analytics.newValue || {};
  if (changes.secondsPerPost) {
    const hadDraft = sessionRead('dotlens-seconds-draft') !== null;
    secondsPerPost = validSeconds(changes.secondsPerPost.newValue ?? 15);
    if (!hadDraft) $('seconds').value = secondsPerPost;
    updateDirty();
  }
  if (changes.feedbackDismissed) $('feedback').hidden = changes.feedbackDismissed.newValue === true;
  render();
});
(async () => {
  try {
    const local = await chrome.storage.local.get(['analytics', 'secondsPerPost', 'feedbackDismissed']);
    analytics = local.analytics || {}; secondsPerPost = validSeconds(local.secondsPerPost ?? 15);
    $('seconds').value = sessionRead('dotlens-seconds-draft') ?? secondsPerPost;
    $('feedback').hidden = local.feedbackDismissed === true;
    await loadProfiles();
  } catch { $('error').textContent = 'Could not load your dashboard. Reload the extension and try again.'; }
})();
function updateNavigation() {
  const preferences = location.hash === '#preferences';
  $('overview-view').hidden = preferences; $('preferences-view').hidden = !preferences;
  $('edit-profile').hidden = preferences;
  $('page-title').textContent = preferences ? 'A profile for every kind of focus.' : 'Your focus, in perspective.';
  $('page-description').textContent = preferences ? 'Choose your topics. Save your rules. Make room for what matters.' : 'See your filtering activity across both profiles.';
  document.title = 'DotLens · ' + (preferences ? 'Profile settings' : 'Overview');
  document.querySelectorAll('.nav').forEach(link => {
    const active = link.getAttribute('href') === (preferences ? '#preferences' : '#overview');
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', () => { updateNavigation(); window.scrollTo(0, 0); });
updateNavigation();

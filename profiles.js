// Two fixed profile slots. Legacy settings remain the fallback for Profile 1.
const DotLensSettings = (() => {
  const ids = ['1', '2'];
  const profileId = value => ids.includes(value) ? value : '1';
  function profile(settings, id) {
    const saved = settings['focusProfile' + id] || (id === '1' ? settings : {});
    return {
      name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim().slice(0, 40) : 'Profile ' + id,
      goals: typeof saved.goals === 'string' ? saved.goals : '',
      avoid: typeof saved.avoid === 'string' ? saved.avoid : '',
      blurMode: ['red', 'nongreen', 'off'].includes(saved.blurMode) ? saved.blurMode : 'red'
    };
  }
  async function load() {
    const [sync, local] = await Promise.all([
      chrome.storage.sync.get(['focusProfile1', 'focusProfile2', 'activeProfileId', 'goals', 'avoid', 'blurMode']),
      chrome.storage.local.get(['enabled', 'learned', 'profileLearned1', 'profileLearned2'])
    ]);
    const activeId = profileId(sync.activeProfileId);
    return {activeId, profiles: Object.fromEntries(ids.map(id => [id, profile(sync, id)])),
      enabled: local.enabled !== false,
      learned: local['profileLearned' + activeId] || (activeId === '1' ? local.learned : null) || {}};
  }
  async function save(id, value) {
    id = profileId(id);
    await chrome.storage.sync.set({['focusProfile' + id]: profile({['focusProfile' + id]: value}, id)});
  }
  const activate = id => chrome.storage.sync.set({activeProfileId: profileId(id)});
  const relevant = (changes, area) => area === 'sync'
    ? ['focusProfile1', 'focusProfile2', 'activeProfileId', 'goals', 'avoid', 'blurMode'].some(key => key in changes)
    : area === 'local' && ['enabled', 'learned', 'profileLearned1', 'profileLearned2'].some(key => key in changes);
  return {load, save, activate, relevant};
})();

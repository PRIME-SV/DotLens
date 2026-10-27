importScripts('analytics.js');
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'post-observed') return;
  if (!sender.tab || !/^https:\/\/(?:x|twitter)\.com\//.test(sender.url || '')) return;
  queue = queue.catch(() => {}).then(async () => {
    const { analytics = {} } = await chrome.storage.local.get('analytics');
    await chrome.storage.local.set({ analytics: recordEvent(analytics, message.event) });
  });
  queue.then(() => reply({ok: true}), () => reply({ok: false}));
  return true;
});

importScripts('analytics.js');
let queue = Promise.resolve();
let pending = [], timer;
function flush() {
  timer = null;
  const batch = pending; pending = [];
  queue = queue.catch(() => {}).then(async () => {
    const {analytics = {}} = await chrome.storage.local.get('analytics');
    const now = new Date();
    for (const request of batch) for (const event of request.events) recordEvent(analytics, event, now);
    await chrome.storage.local.set({analytics});
  });
  queue.then(() => batch.forEach(request => request.reply({ok:true})), () => batch.forEach(request => request.reply({ok:false})));
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!['post-observed', 'posts-observed'].includes(message?.type)) return;
  if (!sender.tab || !/^https:\/\/(?:x|twitter)\.com\//.test(sender.url || '')) return;
  const events = message.type === 'posts-observed' ? message.events : [message.event];
  if (!Array.isArray(events) || events.length > 2000) { reply({ok:false}); return; }
  pending.push({events, reply});
  if (!timer) timer = setTimeout(flush, 50);
  return true;
});

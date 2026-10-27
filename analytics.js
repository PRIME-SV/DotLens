// Serialized in the service worker so multiple tabs cannot overwrite one another.
const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function recordEvent(analytics, event, now = new Date()) {
  // Keep existing numeric X keys; namespace Reddit IDs to avoid collisions.
  if (!event || typeof event.id !== 'string' || !/^(?:\d+|reddit:t3_[a-z0-9]+)$/.test(event.id) || !['green', 'red', 'gray'].includes(event.state)) return analytics;
  const day = localDay(now);
  analytics.version = 1;
  analytics.started ||= day;
  analytics.days ||= {};
  const posts = analytics.days[day] ||= {};
  const previous = posts[event.id];
  const reasons = Array.isArray(event.reasons) ? [...new Set(event.reasons.filter(x => typeof x === 'string').map(x => x.slice(0, 240)))].slice(0, 50) : [];
  posts[event.id] = {
    state: event.state,
    hidden: Boolean(event.hidden),
    everHidden: Boolean(previous?.everHidden || event.hidden || event.everHidden),
    revealed: Boolean(previous?.revealed || event.reveal),
    reasons: event.hidden || event.everHidden ? reasons : (previous?.reasons || [])
  };
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  for (const key of Object.keys(analytics.days)) if (key < localDay(cutoff)) delete analytics.days[key];
  return analytics;
}

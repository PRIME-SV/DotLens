const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validSeconds = value => Number.isFinite(Number(value)) ? Math.max(1, Math.min(300, Math.round(Number(value)) || 15)) : 15;
function summarize(analytics, range, seconds = 15, now = new Date()) {
  const totals = {seen: 0, hidden: 0, revealed: 0, saved: 0, reasons: new Map(), series: []};
  for (let offset = range - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = dayKey(date);
    let hidden = 0;
    for (const post of Object.values(analytics?.days?.[key] || {})) {
      totals.seen++;
      if (post.everHidden) {
        totals.hidden++; hidden++;
        if (post.revealed) totals.revealed++;
        if (post.hidden && !post.revealed) totals.saved += validSeconds(seconds);
        for (const reason of new Set(post.reasons || [])) totals.reasons.set(reason, (totals.reasons.get(reason) || 0) + 1);
      }
    }
    totals.series.push({key, date, hidden});
  }
  return totals;
}
function duration(seconds) {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} sec` : ''}`;
  return `${Math.floor(seconds / 3600)} hr ${Math.floor(seconds % 3600 / 60)} min`;
}

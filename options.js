const $ = id => document.getElementById(id);
chrome.storage.sync.get(["goals", "avoid", "blurMode"], s => {
  $("goals").value = s.goals || ""; $("avoid").value = s.avoid || ""; $("blurMode").value = s.blurMode || "red"; });
$("save").onclick = () => chrome.storage.sync.set(
  { goals: $("goals").value, avoid: $("avoid").value, blurMode: $("blurMode").value },
  () => { $("msg").textContent = "Saved. Refresh X."; });

# DotLens 0.2.1

Load this folder as an unpacked extension in Chrome. After an update, reload it at chrome://extensions and refresh existing X tabs. Click the toolbar icon, then Open focus dashboard. Chrome's extension Details > Extension options opens the same dashboard.

## Analytics

- Counts posts entering the viewport, once per post ID per local calendar day, across tabs and refreshes.
- Posts hidden counts posts that were covered at least once that day; revealed posts remain in this historical count.
- Estimated time saved = posts currently recorded as hidden and never revealed that day × configurable seconds per post (default 15). It is an assumption, not measured reading time. The estimate changes retroactively when this setting changes.
- Reasons record matching avoid terms or learned negative words. Manual corrections and strict-mode no-goal matches have separate reason labels. A post can have several reasons.
- The most recently observed state and hide reasons are retained per post/day. No post text is stored. Old daily records are pruned to 30 days when the next post event arrives.
- Existing legacy color counters are not converted into hidden-post analytics.
- Analytics stay in chrome.storage.local. Goals, avoid terms and blur mode continue to use chrome.storage.sync when enabled.

## Matching

Separate literal keywords, phrases or sentences with commas or newlines. Phrases require consecutive words, ignoring capitalization and extra whitespace. Regex characters are escaped, and word boundaries prevent substring matches. AI and other short terms work. Feedback learning remains word-based.

## Verification

Tests are in ../tests. Run analytics.cjs using Node for aggregation and concurrency checks. dashboard.cjs uses the bundled Playwright package and Edge in a temporary headless profile, with mocked Chrome storage and a simulated feed. These tests do not use a real X account or real browsing data. Screenshots in ../tests contain synthetic QA data, not user analytics. The current X interface has not been tested live.


## 0.2.1 scrolling improvements

Only added or changed post candidates are processed, in short idle chunks. Text reads use textContent, matchers are compiled on settings load, and DotLens ignores its own control mutations. Analytics are deduplicated and batched over short intervals, with concurrent worker requests sharing storage writes. The previous live backdrop blur is replaced with an opaque cover to avoid expensive compositing while scrolling. Reveal controls and counts remain available. Preference changes now reprocess existing posts.

A repeatable 60-post simulated-feed check (eight unrelated updates, then four down/up scroll cycles) reduced full-feed scans from 8 to 0, layout-dependent text reads from 480 to 0, and analytics messages during scrolling from 32 to 1. These are workload measurements, not an FPS guarantee for the live X site.

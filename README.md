# Canonical repository: D:\dotlens

# DotLens 0.3.2 · X and Reddit

Load this folder as an unpacked extension in Chrome. After an update, reload it at chrome://extensions, approve Reddit site access if Chrome requests it, and refresh existing X and Reddit tabs. Click the toolbar icon, then Open focus dashboard. Chrome's extension Details > Extension options opens the same dashboard.

## Reddit support

- Uses the same goals, avoided phrases, hiding mode, corrections, and local dashboard as X. Settings and learned word weights are shared between both sites.
- Recognizes modern `shreddit-post` cards, older `post-container` articles, and classic `.thing.link` posts on reddit.com, www.reddit.com, old.reddit.com, and new.reddit.com (including redirects to the current layout).
- Classifies only the author's available post title and loaded body text. Comment trees, AutoModerator announcements, moderation notices, metadata and surrounding page UI are excluded before collecting text, even if nested inside a body wrapper. Does not read/filter individual comments, direct messages, images, or videos. On discussion pages only the post card is covered; comments remain available. Unloaded content cannot be classified.
- Reddit post IDs use `reddit:t3_<id>` in local analytics. Existing numeric X IDs and historical analytics are preserved. Totals combine both platforms and deduplicate each post per local day, including visits through different Reddit layouts.
- Supports posts added or edited after navigation, and open shadow roots used by Reddit's card components. Markup changes or closed shadow roots can affect compatibility.

## Analytics

- Counts posts entering the viewport, once per post ID per local calendar day, across tabs and refreshes.
- Posts hidden counts posts that were covered at least once that day; revealed posts remain in this historical count.
- Estimated time saved = posts currently recorded as hidden and never revealed that day × configurable seconds per post (default 15). It is an assumption, not measured reading time. The estimate changes retroactively when this setting changes.
- Reasons record matching avoid terms or learned negative words. Manual corrections and strict-mode no-goal matches have separate reason labels. A post can have several reasons.
- The most recently observed state and hide reasons are retained per post/day. No post text is stored. Old daily records are pruned to 30 days when the next post event arrives.
- Existing legacy color counters are not converted into hidden-post analytics.
- Analytics stay in chrome.storage.local. Goals, avoid terms and blur mode continue to use chrome.storage.sync when enabled.

## Matching

Separate literal keywords, phrases or sentences with commas or newlines. Phrases require consecutive words, ignoring capitalization and extra whitespace. Regex characters are escaped, and Unicode word boundaries prevent substring matches. For example, `AI` matches `AI`, `AI,` and `(AI)` but not `said`, `paid`, `mail`, `OpenAI` or `AItools`. Both goals and avoided topics use this rule. Feedback learning remains word-based; learned words can independently affect classification. Run `node tests/matching.cjs` for standalone-word, punctuation, Unicode and phrase regression checks.

## Verification

Tests are in `tests/` in this repository. Run `node tests/analytics.cjs` for aggregation, cross-platform ID validation and concurrent worker checks. `node tests/dashboard.cjs` checks the dashboard and X regression behavior. `node tests/reddit.cjs` checks modern shadow-DOM cards, old/legacy Reddit, title/body isolation, incremental updates, reveals, corrections and shared modes. `node tests/performance.cjs` checks incremental processing on a synthetic X feed. Browser tests use bundled Playwright and Edge in temporary headless profiles with mocked Chrome storage. No real account or browsing data is used. Screenshots contain synthetic QA data. The current live X and Reddit interfaces have not been tested in a signed-in browser.


## 0.2.1 scrolling improvements

Only added or changed post candidates are processed, in short idle chunks. Text reads use textContent, matchers are compiled on settings load, and DotLens ignores its own control mutations. Analytics are deduplicated and batched over short intervals, with concurrent worker requests sharing storage writes. The previous live backdrop blur is replaced with an opaque cover to avoid expensive compositing while scrolling. Reveal controls and counts remain available. Preference changes now reprocess existing posts.

A repeatable 60-post simulated-feed check (eight unrelated updates, then four down/up scroll cycles) reduced full-feed scans from 8 to 0, layout-dependent text reads from 480 to 0, and analytics messages during scrolling from 32 to 1. These are workload measurements, not an FPS guarantee for the live X site.



## Privacy

Read the [DotLens Privacy Policy](PRIVACY-POLICY.md) for details about local analytics, Chrome sync, retention, and user controls.

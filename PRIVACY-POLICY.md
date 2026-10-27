# Privacy Policy for DotLens: Social Feed Filter

**Effective date: 26 October 2026**
**Last updated: 27 October 2026**

DotLens: Social Feed Filter ("DotLens") is a Chrome extension maintained by [PRIME-SV](https://github.com/PRIME-SV) in the [DotLens repository](https://github.com/PRIME-SV/DotLens). This policy explains how version 0.3.0 processes and stores information when you use it on the X/Twitter and Reddit websites, including modern and old Reddit.

## 1. What DotLens does

DotLens reads available post text in your browser, compares it with your goals, avoided topics, and locally learned word weights, and adds classification dots or user-controlled covers. On Reddit it uses post titles and loaded body text, not individual comments. It also provides a dashboard describing filtering activity across both sites. Goals, avoided topics, hiding mode, and learned word weights are shared between X and Reddit. Classification is rule-based. The current extension does not send feed content to an AI service.

## 2. Information processed and stored

### Post content processed in your browser

DotLens processes the text and identifiers of posts loaded on X/Twitter and Reddit to classify them and manage the filtering interface. This may include posts from protected X accounts or restricted Reddit communities that your signed-in account is permitted to view. It does not bypass access restrictions. Full post text is not saved in the extension's persistent analytics storage or sent to the developer. Reddit identifiers include a platform prefix so they remain separate from X identifiers.

### Preferences you enter

DotLens stores your goals, avoided keywords or phrases, and hiding mode. These preferences can reveal interests or other information you choose to enter.

### Local learning and analytics

DotLens stores:

- Word weights derived from your classification corrections. These can include words from posts you corrected.
- Post IDs, the local calendar date of observation, and green/red/gray classifications.
- Whether a post was hidden, was previously hidden, or was revealed by you.
- Matching words or phrases and other filtering reasons.
- Your configurable seconds-per-post assumption used to estimate time saved.

Post IDs identify posts and can be associated with content on X. Analytics and learned words should therefore not be treated as anonymous data. Temporary page-session state, including reveal choices and deduplication records, is also held in memory.

DotLens does not intentionally collect your X or Reddit password, authentication cookies, payment information, or general browsing history across other websites. It does not provide direct-message or individual Reddit comment analysis or image/video understanding.

## 3. Where information is stored

**Local extension storage (`chrome.storage.local`):** Analytics, learned word weights, and the time-estimate setting are stored in the extension's local storage on your device. There is no DotLens developer backend receiving this information. Information stored on your device may be accessible to people or software with access to your device or browser profile.

**Chrome sync storage (`chrome.storage.sync`):** Goals, avoided terms, and hiding mode use Chrome sync storage. When Chrome syncing is enabled, Google may store and synchronize these settings across your signed-in browsers. When syncing is disabled, this storage behaves locally. Google's processing is governed by your Chrome settings and [Google's Privacy Policy](https://policies.google.com/privacy).

DotLens uses extension storage rather than creating its own website tracking cookies.

## 4. How information is used

Information is used to:

- Classify and optionally hide posts according to your preferences.
- Explain why a post was hidden and allow you to reveal it.
- Adjust local word weights after corrections.
- Avoid counting the same post repeatedly within a local calendar day.
- Display filtering totals, matching terms, charts, reveal counts, and estimated time saved.
- Preserve your preferences between sessions and, when enabled, across Chrome-synced browsers.

Time saved is an estimate based on your chosen seconds-per-post assumption, not a measurement of how long you would otherwise have read a post.

## 5. Sharing and third-party services

The current extension does not send post text, analytics, or learned word weights to the developer, advertisers, data brokers, an AI provider, or an external analytics service. The developer does not sell this information or use it to target advertisements. DotLens does not include a third-party advertising or analytics SDK.

Chrome synchronization is the exception described in Section 3: settings stored in Chrome sync may be transmitted to Google by Chrome. Your ordinary use of X and Reddit remains subject to each platform's own data practices; locally covering a post does not prevent that platform from loading it or observing activity through its own website.

Opening this policy on GitHub or posting feedback there involves GitHub's own services and [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Public issue comments are visible to others and are separate from the extension's local analytics.

DotLens's use of user data is limited to providing and improving its stated filtering and dashboard functionality, consistent with the Chrome Web Store User Data Policy and its Limited Use requirements.

## 6. Retention and deletion

The dashboard shows a rolling 30-day analytics window. Daily records older than that window are removed when new post activity is recorded. If the extension is not used, older records may remain in local storage until the next recorded activity or removal of the extension's data.

Learned word weights, preferences, and the time-estimate setting persist until changed or removed. Temporary page-session state is released when that page session ends.

Uninstalling the extension removes its local extension storage from that browser profile. Chrome-synced preferences are subject to Chrome's sync behavior and may be retained or restored when the extension is reinstalled. Manage synchronized information through Chrome's sync controls. Clearing ordinary website browsing history does not necessarily clear extension storage.

## 7. Your choices

You can edit goals and avoided terms, change the hiding mode, reveal hidden posts, and adjust the time-estimate assumption in DotLens. You can restrict site access, disable the extension, or uninstall it through Chrome's extension controls. Disabling the extension stops it from processing new activity but does not itself delete stored data.

The developer cannot access or erase your local analytics remotely. Contact the maintainer below if you need guidance about removing extension data. Do not include private post content, credentials, or other sensitive information in public feedback.

## 8. Proposed AI features

The dashboard may ask whether you would pay for optional AI analytics or AI-assisted post understanding. This is a request for feedback, not an active AI integration, subscription, or payment collection feature. The banner does not itself collect a survey response.

If future features introduce new data handling, this policy and the extension's disclosures will be updated, with any required notice and consent provided before the new handling begins.

## 9. Policy updates and contact

Updates will be published in this repository with a revised date. Material changes to data practices will also be disclosed in the extension as required by applicable Chrome Web Store policies.

For privacy questions, contact the maintainer through the [DotLens GitHub issue tracker](https://github.com/PRIME-SV/DotLens/issues). This is a public channel: use it for general questions or to request a suitable way to discuss a private matter without posting sensitive details.

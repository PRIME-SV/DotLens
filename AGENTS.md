# DotLens repository instructions

This directory, D:\dotlens, is the canonical repository designated by the user. Make all DotLens application changes, tests and release builds here. Do not edit the old C:\Users\Admin\Documents\ChatGPT\Social Filter\dotlens copy as the source of truth.

The Chrome extension files and manifest.json are at the repository root. Preserve unrelated local changes. Tests live in tests/. Run node tests/matching.cjs, node tests/analytics.cjs, node tests/reddit.cjs and node tests/dashboard.cjs as appropriate. Browser tests use the locally bundled Playwright package and headless Edge; request escalation if the sandbox prevents launching it.

Reddit matching uses only the author's post title and loaded body. Never include comments, AutoModerator announcements, moderation notices or surrounding UI in classification or correction learning. Goals and avoided topics match whole words and literal phrases. Preserve local analytics and existing numeric X IDs.

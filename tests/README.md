# HelixBoard tests

Playwright suites (Node, headless Chromium and the Electron app). One runner gives every suite a fresh, empty profile
(`HB_USER_DATA`; test mode skips the opening titles and sign-in).

```
python3 build.py && (cd desktop && npm run prepare-app)
cd tests && node runall.js            # all suites, then a pass count
node runall.js ink ppt kb             # some suites
```

The Electron suite (`crawl3`) runs under `xvfb-run` and expects the repository at `/home/user/helixboard` (a link to the checkout works).

v3.0.0 suites: `ink` (fast stroke commit equals a full redraw for every pen, layers, undo, saving after a pause and on closing,
a 2.8 board with unknown objects), `sweep` (every tool button, touch, two screen sizes). `inkbench.js` is the writing-speed benchmark
(`--profile`, `--tasks`, `--trace out.json`, `--screen 1366x768`, `--strokes`, `--pics`, `--seconds`, `--json out.json`).
Suites for removed features (live class, phones, tests, exams, reports, video lessons, paper cards) were deleted with them.

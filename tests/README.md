# HelixBoard tests

Playwright suites (Node, headless Chromium and the Electron app). One runner gives every suite a fresh, empty profile
(`HB_USER_DATA`; test mode skips the opening titles and sign-in).

```
python3 build.py && (cd desktop && npm run prepare-app)
cd tests && node runall.js            # all suites, then a pass count
node runall.js sx ppt kb              # some suites
```

Electron suites run under `xvfb-run` (Linux CI). The suites expect the repository at `/home/user/helixboard`; change the
paths at the top of a suite to run it elsewhere. Fixtures: `anim.pptx`, `rich.pptx`, `trans.pptx` (PowerPoint), `lesson_s.mp4`
(video lessons), `qb/` (worksheets, answer keys, equations, Mr. Hany's G10 midterm worksheet), `fake-cloudflared` (offline tunnel).

v2.7.0 suites: `ppt` (slides keep going after writing, 20 advances, 1–2 ms each), `sx` (bubble-sheet exam with two phones,
offline and reload, negative marking, integrity flags, the key never reaches a phone), `kb` (on-screen keyboard, English and
Arabic), `mm4` (moving branches), `qimp` (worksheet reading, 13 answer-key layouts).

v2.8.0 suite: `plus` (51 checks with the network blocked: the ten learning tools, the lab models, the offline libraries, the layout at
768 and 390 px). It finds the build next to the tests folder, so it runs from any checkout.

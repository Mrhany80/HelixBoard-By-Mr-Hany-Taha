# HelixBoard By Mr. Hany Taha — the Science Slate

> **Version 3.0 "Lean".** Writing speed first: a finished stroke is painted at once and saving waits for a pause. Live class on phones,
> reports, tests and exams, video lessons, paper cards, recording and the water reminder were removed (368 → 304 tools).
> See `docs/3.0-removed-tools.md`. The full 2.8 version is on the branch `archive/full-2.8`. Sections below that mention a removed
> feature describe 2.8.

Single-file interactive whiteboard for biology and science lessons.
Designed by Mr. Hany Taha for Green Hills International School (GHIS), Jeddah.

Version **2.8.0** — three ways to run it, all built from the same `app/` source:

| Device | What | Install |
|---|---|---|
| Windows PC / smartboard | Electron app (`desktop/`) | Setup or Portable `.exe` |
| Android tablet | Installable web app (`dist/`) | Chrome → ⋮ → **Install app** |
| iPad | Installable web app (`dist/`) | Safari → Share ↑ → **Add to Home Screen** |

The web app runs full screen, works **offline** after the first visit, and updates itself:
when a new version is uploaded, users see **“Update now”**.

## Build

```bash
python3 build.py          # → dist/index.html
python3 build.py out.html # → also writes out.html
```

No npm, no bundler. Everything is concatenated into one HTML file:
- `app/shell.html` — the HTML shell and global CSS
- `app/*.js` — the 26 app modules (see Modules below)
- `app/icons.json`, `app/elements.json` — Lucide icons and the periodic table
- `vendor/*` — pdf.js, pptx-preview, mammoth and jsPDF, inlined for offline
- `vendor/fonts/*` — Lexend, Space Grotesk, JetBrains Mono and Caveat (SIL Open Font License), inlined so the app looks the same offline
- `app/design.css` — the 2.3 design layer, added last so it refines the base styles

## Modules (load order)

| Module | What it does |
|---|---|
| core.js | HB global: `set` (localStorage), IDB, `bus`, modals, toast, `need()` library loader, SND |
| engine.js | Canvas, viewport (`V`), themes, pages, dates, Hijri formatter, draw/render, undo/redo |
| input.js | Pointer events, pen tray, tools: draw / shape / text / erase / select / lasso / hand / laser, radial menu, pen presets, DNA cursor |
| stamps.js | Shape and stamp libraries |
| sci_bio.js | Biology stamps, templates, Punnett, pedigree, food-web, cell cycle |
| sci_chem.js | Chemistry equations, molecules, periodic table, shells, dot & cross |
| sci_phys.js | Vectors, waves, circuits, instruments (ruler, protractor), unit converter |
| calc.js | Scientific calculator |
| keyboard.js | On-screen science keyboard with Arabic / symbols / sub/super |
| recog.js | Ink → shapes, straighten, smooth, ink → text, photo → text (Tesseract) |
| classtools.js | Timer, stopwatch, groups, dice, spotlight, curtain, traffic light, noise |
| notes.js | 26 note templates (Cornell, KWL, Frayer, Venn, mind-map, fishbone, CER, POE, lab report …) |
| smart.js | Smart templates: zones, auto-fit, Fit/Fill screen, 8-direction resize, handwriting-only |
| mindmap.js | Miro-style concept maps (`HBMM`): idea nodes, curved coloured branches, Tab/Enter, fold, layouts, cross-links, templates, outline → map |
| deck.js | PDF / PowerPoint one-tab decks: slide panel, slideshow, transitions, sorter, blank slides, export |
| wheel.js | Wheel of Names |
| timer.js | Lesson timer |
| io.js | Save/open `.helix`, PDF/PPTX/DOCX/TXT import, camera, PNG/PDF export, replay, record |
| ui.js | Tab bar (helix ribbon + side rail), tool panel, dock, pen tray, dialogs, drawer, settings |
| fullscreen.js | Full-screen mode for any page, left-side zoom+pen panel, collapse |
| toolsize.js | 100/125/150/175% tool-button size |
| roots.js | Scientific Roots Dictionary (438 roots/prefixes/suffixes) |
| studio.js | **Teach** and **Study** tabs: lesson plan + objectives card + lesson flow timer, live class quiz with hand tallies and results, show-me boards, confidence check, retrieval starter, question stems (Bloom’s), cold call, command words + answer frames, team points; for students: practice quiz with mistakes log, spaced-repetition flashcards, focus timer, brain dump, explain-it-simply and exam answer planners, progress dashboard. Quiz/flashcard sets are written by the user and shared as `.hbset` files |
| notekit.js | Notes tab tools: text styles, lists that continue on Enter, callout boxes (key fact, definition, exam tip …), typeable tables, sections/dividers, highlighters, marking stamps, hide & reveal covers, frames (named areas to jump between), read aloud, notes → flashcards, screen capture / annotate screen |
| plus.js | **2.8 learning tools**, one per tab: Ghost trace, Live measure, Cloze, Notes → quiz, Before / after slider, Mini-labs (enzyme, osmosis, predator–prey), Lesson runway strip, Fair talk, Lesson recap (`window.HBP`) |
| intro.js | Welcome screen and tap-to-start |
| main.js | Boot and glue code |

## Where things live globally

- `window.HB`   — core helpers (set, bus, modal, toast, icon, need, SND, uid)
- `window.HBE`  — engine (B, V, page, bbox, toS/toB, zoomAt, fitWidth, undo/redo, add/del/mod)
- `window.HBI`  — input (T, setTool, setColor, setSize, select, radial)
- `window.HBS`  — stamps, templates, bio/chem/phys helpers
- `window.HBUI` — tabs, buildRow, buildDock, addPage, goPage, delPage
- `window.HBN`  — smart templates (fitScreen, typeIn, textPlace, dbl, addPart)
- `window.HBD`  — decks (create, goSlide, startShow, exportDeck)
- `window.HBF`  — full-screen mode
- `window.HBRD` — roots dictionary
- `window.HBC`  — class tools (timer, groups, spotlight …)
- `window.HBW`  — wheel of names
- `window.HBT`  — timer
- `window.HBH`  — hydration (water)
- `window.HBIO` — files I/O
- `window.HBK`  — on-screen keyboard
- `window.HBR`  — recognition (shapes, text, loupe)
- `window.HBInst` — physical instruments (ruler, protractor)
- `window.HBCalc` — calculator
- `window.HBNK` — note-taking kit (style, list, box, table, stamp, cover, frameNav, readAloud, toCards, screenCapture, annotateScreen)
- `window.HBL`  — Teach & Study studio (plan, flow, presentQuiz, practise, flashcards, retrieval, stems, teams, focus, progress, importFiles …)

## Tabs

Ten tabs: **Draw** (pens, erase, select, colour, ink magic) · **Shapes** · **Text** (styles, fonts, photo → text) ·
**Notes** (rich note-taking kit + note templates and thinking maps) · **Insert** (images, documents, PowerPoint, stamps, screen) ·
**Science** (Biology, Chemistry, Physics, Lab, Maths, Roots — filter chips at the top) ·
**Teach** (lesson, timers, wheel and pickers, quiz on the board, assessment, focus tools, water — filter chips) ·
**Study** (Live class on phones — and student self-study tools; filter chips) · **Collaborate** (ten group-work structures with phase timers, groups and roles, the live sticky wall) · **Page** (page, backgrounds, files, intro setting — filter chips).
Tab definitions live in `ui.js`: `SRC` holds every tool group, `TABS` assembles the ten tabs from them.

### Learning tools (2.8)

| Tab | Tool | How it is used |
|---|---|---|
| Draw | **Ghost trace** | Select a drawing → Trace (pale copy) → From memory (hidden) → Check (model in green under your ink). |
| Shapes | **Live measure** | Sizes follow lines and shapes. Select an object of known size, type its real length → **Set scale**. |
| Text | **Cloze** | Select a text box → choose or suggest key words → tap the text with any tool except Select to open a blank. |
| Notes | **Notes → quiz** | “term - definition” lines (selection, page or whole board) → multiple-choice quiz set. |
| Insert | **Before / after** | Select two pictures → slider or fade. |
| Science → Lab | **Mini-labs** | Predict → observe → explain: enzyme activity, osmosis, predator–prey. Graph and sentence starters go to the board. |
| Teach | **Lesson flow** | Phase timers, now with a runway strip on the board and an automatic next phase. |
| Study | **Due today** | All due flashcards from every deck in one mixed session. |
| Collaborate | **Fair talk** | Tap names as students contribute; pick from those who have spoken least. |
| Page | **Lesson recap** | A last page with headings, key ideas and questions from the whole board. |

Objects carry small flags for these: `gh` (ghost model), `cz` (cloze: original text, hidden and opened word indexes), `ms`
(a written measurement); pages carry `ghost` (`faint` / `hide` / `show`) and `sc` (scale: pixels per unit, unit).

Right-click, the pen's barrel button and a long-press open one radial menu (with Duplicate / Copy / Front / Delete for a
selection); the browser's own menu appears only in text fields. In the slideshow Space, Enter, PageDown, → and a clicker
always go to the next step (←, PageUp, Backspace go back), whatever the tool; with a text box open, Esc closes it and
PageDown/PageUp close it and continue. Press **K** for the on-screen keyboard (English, Arabic, science layers).

## PowerPoint animations

Slides are drawn at up to **4K** (Quality: Standard / High / Premium 4K, the default) with high-quality image smoothing.
When a PowerPoint has click animations, the import offers **Play animations**. `io.js` reads each slide's `<p:timing>` (a tiny
zip reader, no library) and renders one picture per click with the not-yet-shown shapes or bullet points hidden. In the
slideshow (F5) each click reveals the next step with a fade; going back from the next slide shows the finished slide.
Slide transitions (**As in PowerPoint** — each slide's own `<p:transition>` with its direction, speed and automatic timing — or Fade, Fade through black, Push, Cover, Uncover, Wipe, Split, Circle, Zoom, Glide, None; picked in the slide bar) lay a picture of the old slide over the
new one and dissolve, push or wipe it away, so there is no dark flash between slides.
Motion paths, emphasis effects and videos are not reproduced; animated slides import as pictures so the steps line up.

## Pen

Draw → Options → **Sensitivity** (1–10, default 8): higher follows the pen more tightly (less smoothing lag), shows light
pressure more strongly and records smaller movements. Ink uses `pointerrawupdate` where available, so samples arrive as soon
as the digitiser sends them.

## Concept map details

Notes → **Concept map**. Round **+** handles on the selected idea add a **sub-branch** (on the side its branches grow) or a
**branch at the same level** (below); the centre has a **main branch** handle on each side. **Drag a branch onto another idea
to attach it there** (it takes that branch's colour, one Undo step); drop it anywhere else to reorder it among its siblings. Ideas have no resize/rotate handles; the bar above an idea moves wherever it does not
cover another idea. A pen tap selects an idea, a double tap types in it, a pen drag moves its branch (no ink). A new idea left
empty disappears; adding an idea and typing in it is one Undo step (`E.histLen`/`E.squash`). Arrow keys walk the map.

## Smoothness

- Panning reuses the picture already drawn (`mainSnap`) and draws only the strips that came into view; a full redraw follows
  140 ms after the movement stops. Boards over 150 objects only.
- Pictures over 4.2 megapixels (4K slides) are drawn from a screen-sized `ImageBitmap`; the full picture is decoded only when
  zoomed in past it, and at most three stay decoded.
- Startup: interactive after about 0.6 s plus 0.25 s to open the board. A 60-round lesson simulation shows no memory growth.

## Tests

`python3 build.py && cd tests && node runall.js` runs 11 suites: `ink` (20 checks on the ink path and saving), `sweep` (every tool
button tapped with touch at 3840x2160 and 1366x768), `crawl3` (the same inside the Windows app shell), `mm`, `mm3`, `mm4` (concept maps),
`anim`, `tr2`, `ppt` (PowerPoint), `kb` (keyboard) and `plus` (the 2.8 learning tools). `node tests/inkbench.js` measures writing speed
on a full board; results are in `docs/perf-baseline.md` and `docs/perf-after.md`.

## Quiz and flashcard sets

There are no built-in question banks — teachers and students write their own sets
(**Teach → Quiz sets / Flashcard sets**, or **Study → My quiz sets / My flashcards**).

Quiz format — a blank line between questions, `*` marks the right option, no `*` makes it a class poll:

```
1. Which organelle carries out aerobic respiration?
A) Nucleus
B) Mitochondrion *
C) Ribosome
Why: optional explanation shown after the answer.
```

Flashcards — one per line: `term - definition`.

**Share / export** saves a `.hbset` file. Students open it with **Study → Import a set**,
by dropping it on the board, or (desktop app) by double-clicking it.
Progress (streak, focus minutes, quiz scores, flashcard boxes, mistakes) stays on each student's own device; with an account, quiz and homework results are also sent to the admin page.

## Accounts (Supabase, free tier)

Teachers and students can create an account (username + password; no email needed) — or continue without one.
Signed-in use is logged (app opens, tools used, imports, recordings, quiz and homework results), and the
**Admin page** (account button → Admin page) shows every user, school, grade, last active, sessions,
usage in the last 7 days, quiz averages, most-used features, each person's results, role changes,
password resets and a CSV export.

One-time setup in the Supabase dashboard (project URL and publishable key are in `app/account.js`):
1. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
2. **Authentication → Sign In / Providers → Email** → turn **off “Confirm email”** (accounts use internal
   addresses like `username@users.helixboard.app`, which cannot receive mail).
3. Open HelixBoard and create your own account.
4. Back in the SQL Editor run: `update public.profiles set role = 'admin' where username = 'your-username';`

Security: only the *publishable* key is in the app. Row-level security lets each person read only their own
data; the admin functions check `is_admin()`. Never put the `service_role` key or the database password in the app.
Activity is queued on the device when offline and sent later.

## Tablet web app (Android and iPad)

`python3 build.py` also writes `dist/manifest.webmanifest`, `dist/sw.js` (versioned offline cache) and `dist/icons/`.
It is published automatically to **https://mrhany80.github.io/HelixBoard-By-Mr-Hany-Taha/** by GitHub Pages on every push to `main`.
Students open the address once and install it (Page tab → **Install as app** shows the steps for their device).
To publish an update, push to `main` — installed copies offer **Update now** within 30 minutes or on next launch.

## Windows desktop app

The `desktop/` folder wraps `dist/index.html` in Electron:
installer + portable `.exe`, own window and taskbar icon, Start-menu and desktop shortcuts,
`.helix` and `.hbset` file associations, Save-As dialogs (default `Documents\HelixBoard`),
remembered window size, F11 full screen, F12 developer tools, a native `prompt()`, the phone-quiz server,
screen capture and **Annotate screen** (a transparent pen layer over any program, with “use apps underneath” and “send to board”).

```bash
cd desktop
npm install
npm start          # run it
npm run dist       # → desktop/release/HelixBoard-By-Mr-Hany-Taha-Setup-<version>.exe and …-Portable-<version>.exe
```

Building on Windows needs nothing else. On Linux/macOS the NSIS installer step needs Wine
(Ubuntu: `dpkg --add-architecture i386 && apt install wine64 wine32:i386`).
The `.exe` icon and version details are written by `build/after-pack.js` (no Wine needed for that).
Change the version in `desktop/package.json`. The installers are not code-signed, so Windows
SmartScreen shows “Windows protected your PC” the first time — click **More info → Run anyway**.

### Publishing a Windows update

The installed app checks `https://github.com/Mrhany80/HelixBoard-By-Mr-Hany-Taha/releases/latest/download/latest.json`
a few seconds after start and every 6 hours (also Page tab → **Check for updates**). When the version there is newer it
offers **Update now**, downloads the Setup `.exe`, checks its SHA-256 and runs it.

1. Raise `version` in `desktop/package.json` (and `version` in `app/account.js`), and add a `## <version>` section to `CHANGELOG.md`.
2. Push to `main`.
3. `.github/workflows/release.yml` sees a version with no release, builds the Setup and Portable `.exe` on a Windows runner,
   writes `latest.json`, creates the tag `v<version>` and publishes the release with the notes from `CHANGELOG.md`
   (about 10 minutes). To rebuild a release that exists: **Actions → Windows release → Run workflow**.

By hand (as before 2.8): `cd desktop && npm run dist`, then attach the two `.exe` files and `release/latest.json` to a release named `v<version>`.

The tablet web app updates itself whenever `main` changes (`.github/workflows/pages.yml` rebuilds and publishes it).

## Fixing errors

1. Run `python3 build.py` then open `dist/index.html`.
2. Open the browser console. If a module failed, you'll see
   `HelixBoard: <mod>.js failed to start` — fix that file in `app/`
   and rebuild.
3. `window.__hbErr` lists any module that failed to load.

## Known limits

- Photo → text and handwriting → text still download their libraries the first time; everything else works with no internet.
- The mini-lab questions and explanations are in English only.
- Arabic handwriting recognition is not offered (the interface itself is fully Arabic: the ع button).
- The iPad version is a web app (no App Store build — that needs a Mac and an Apple developer account).
- The Windows installer is not code-signed, so SmartScreen warns on first install.
- PowerPoint animations and videos aren't captured; the slide shows its final look.
- Floating panels, the wheel screen and the on-screen keyboard are not captured in recordings.

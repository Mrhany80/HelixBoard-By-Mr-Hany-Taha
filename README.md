# HelixBoard By Mr. Hany Taha — the Science Slate

Single-file interactive whiteboard for biology and science lessons.
Designed by Mr. Hany Taha for Green Hills International School (GHIS), Jeddah.

Version **2.3.2** — three ways to run it, all built from the same `app/` source:

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
| water.js | Hydration reminder with glass of water |
| io.js | Save/open `.helix`, PDF/PPTX/DOCX/TXT import, camera, PNG/PDF export, replay, record |
| ui.js | Tab bar (helix ribbon + side rail), tool panel, dock, pen tray, dialogs, drawer, settings |
| fullscreen.js | Full-screen mode for any page, left-side zoom+pen panel, collapse |
| toolsize.js | 100/125/150/175% tool-button size |
| roots.js | Scientific Roots Dictionary (438 roots/prefixes/suffixes) |
| studio.js | **Teach** and **Study** tabs: lesson plan + objectives card + lesson flow timer, live class quiz with hand tallies and results, show-me boards, confidence check, retrieval starter, question stems (Bloom’s), cold call, command words + answer frames, team points; for students: practice quiz with mistakes log, spaced-repetition flashcards, focus timer, brain dump, explain-it-simply and exam answer planners, progress dashboard. Quiz/flashcard sets are written by the user and shared as `.hbset` files |
| notekit.js | Notes tab tools: text styles, lists that continue on Enter, callout boxes (key fact, definition, exam tip …), typeable tables, sections/dividers, highlighters, marking stamps, hide & reveal covers, frames (named areas to jump between), read aloud, notes → flashcards, screen capture / annotate screen |
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

Nine tabs: **Draw** (pens, erase, select, colour, ink magic) · **Shapes** · **Text** (styles, fonts, photo → text) ·
**Notes** (rich note-taking kit + note templates and thinking maps) · **Insert** (images, documents, PowerPoint, stamps, screen) ·
**Science** (Biology, Chemistry, Physics, Lab, Maths, Roots — filter chips at the top) ·
**Teach** (lesson, timers, wheel and pickers, quiz on the board, assessment, focus tools, water — filter chips) ·
**Study** (Live class on phones — and student self-study tools; filter chips) · **Page** (page, backgrounds, files, intro setting — filter chips).
Tab definitions live in `ui.js`: `SRC` holds every tool group, `TABS` assembles the nine tabs from them.

## Live class (Windows app) — Nearpod / ClassPoint-style activities

**Study → Live class** (or the gradient **Live class** button in the top bar) opens one dashboard for the whole lesson. Students
scan one QR code (the class link) and their phones switch to whatever the teacher sends:

| Activity | On the phone | On the board |
|---|---|---|
| **Draw it** | a canvas (blank, grid, lines, graph axes, or the teacher's board) with colours, sizes, eraser, undo | every drawing side by side **by name** — 2 to 6 per row (split screen), live as they draw |
| **Quick poll** | A–F, True/False, Yes/No, agree scale; can change until answers close | live bars, who voted, **Reveal answer** turns phones green/red |
| **Word cloud** | up to 3 words | a live word cloud (repeats grow) |
| **Short answer** | a text box | every answer as a card |
| **Photo** | camera or gallery (compressed on the phone) | a photo gallery |
| **Collaborate board** | up to 6 sticky notes in 6 colours | a wall of notes with names |

For every activity: optional time limit (phones show a countdown), **Hide names** (anonymous on screen), **spotlight** one
answer full screen (← → to move), **Share with class** (it appears on every phone), **Give a star** (ClassPoint-style;
students see their stars, **Stars** shows a podium), **Remove** an unsuitable answer, **Put on board** (the whole gallery or
one answer becomes a picture on the board), **Excel (.csv)**. Also: raised hands ✋ and private questions **?** from phones,
**Eyes on board** (locks every phone), plus **Write on my board** (students write on the live board) and the **Quiz game**.
Server side: `desktop/classlink.js` (`setActivity`, `/answer`, `/hand`; every answer is validated by type and size and rate
limited); phone page: `desktop/classlink-student.html`; dashboard: `app/liveclass.js` (`HBLC`).

### Submit once and deadlines

Activities default to **Submit once** (Nearpod/ClassPoint style): students work on a private draft, press **Submit**, and the
answer locks (a second answer is refused by the server). With a **time limit** (up to 30 min) every phone shows a countdown bar
that turns red in the last 10 s; when time is up, unsent drafts are **handed in automatically** (marked ⏰) and late answers are
refused. The teacher sees ✓ submitted / ✎ working / ⏱ not started, can add a minute or reopen, and **Remove · let them redo**
allows one student to answer again. **Live** mode (answers stream in and can change) remains for brainstorming; word clouds and
collaborate boards default to it.

### Running the session

**Eyes on board** pauses every phone; the phones show the teacher's live board (shared just for the pause if *Show my board*
was off) with "Look at the board". Starting a new activity unlocks the phones automatically. **Pick** spins the names of
connected students and lands on one (nobody twice until everyone has been; give a star from there). **Reactions** lets students
tap 👍 ❤️ 😂 😮 🤔 👏 on their phone; the emojis float up over whatever is on screen (one per student every 1.2 s, can be
turned off). With the dashboard hidden, a small pill (top right) shows what is running, with Eyes on board, End and minimise; it
hides itself during the slideshow, video lessons, reports and the big QR code. **End session** (dashboard, pill or
Study → End live session) saves the activity to Reports, closes the link so phones show "The live session has ended", and can
open the lesson's report.

## Reports (like Wayground/Quizizz reports, Power BI-ready)

Every Live class activity and every phone quiz is saved automatically (IndexedDB on this computer), one report per lesson.
**Study → Reports** (or **Reports** in the Live class dashboard) shows: headline cards (students, activities, participation,
accuracy, on time, stars), participation and accuracy charts, class accuracy bands, who needs attention, top students, a
colour-coded student grid (✓ ✗ ● ⏰ —, sortable, click a name for all their answers) and per-activity detail (answer bars,
word lists, written answers, drawing and photo thumbnails). Exports: **Excel (.xlsx)** with Summary, Students, Activities and
Responses sheets (written by a small built-in zip writer), **CSV for Power BI** (one tidy row per student per activity),
**PDF report** (all views, printed by Chromium) and a shareable **.hbreport** file (`app/reports.js`, `HBRP`).

## Video lessons (split by questions, like Nearpod)

**Study → Video lesson**: open an MP4/WebM, pause anywhere and **Add question here** (quick poll with a right answer, short
answer, word cloud, or **Draw it on the paused video frame**). The timeline shows each stop and the side panel lists the parts.
In **Teach** mode the video stops by itself at every question: with phones connected the question goes to Live class and a
**Continue video** button plays on; without phones the question shows big on the screen (with **Reveal answer**).
Questions are remembered per video on this computer and can be saved/loaded as `.hbvid` files (`app/videolesson.js`, `HBVL`).

## PowerPoint animations

When a PowerPoint has click animations, the import offers **Play animations**. `io.js` reads each slide's `<p:timing>` (a tiny
zip reader, no library) and renders one picture per click with the not-yet-shown shapes or bullet points hidden. In the
slideshow (F5) each click reveals the next step with a fade; going back from the next slide shows the finished slide.
Slide transitions (Fade, Push, Wipe, Zoom, Glide, None; picked in the slide bar) lay a picture of the old slide over the
new one and dissolve, push or wipe it away, so there is no dark flash between slides.
Motion paths, emphasis effects and videos are not reproduced; animated slides import as pictures so the steps line up.

## Pen

Draw → Options → **Sensitivity** (1–10, default 8): higher follows the pen more tightly (less smoothing lag), shows light
pressure more strongly and records smaller movements. Ink uses `pointerrawupdate` where available, so samples arrive as soon
as the digitiser sends them.

## Phone quiz (Windows app)

**Study → Quiz game** runs a quiz the way Wayground/Quizizz does: students scan the QR code on the board,
type their name and the 6-digit game PIN, and answer on their phones; faster correct answers score more, streaks earn a bonus,
and the board shows answer bars, a leaderboard and a podium; results export to Excel (.csv).

- **Any network (default):** the app opens a free Cloudflare quick tunnel (`https://<random>.trycloudflare.com`, no account)
  so students can join on mobile data, home Wi-Fi or any other network. `desktop/tunnel.js` downloads Cloudflare's
  `cloudflared.exe` once (≈60 MB) from its official GitHub release and keeps it only if Windows confirms a valid
  Cloudflare code signature or its SHA-256 matches the checksum in the release notes. Quick tunnels are a free Cloudflare
  service without uptime guarantees; some school web filters block `trycloudflare.com` — mobile data then still works.
- **Same Wi-Fi:** if the internet link can't open (or “Let phones join from any network” is switched off), phones on the same
  Wi-Fi join directly (`desktop/live.js`, port 8320–8324). The first time, Windows asks to allow HelixBoard on private networks.
- Phones use long-polling (one open request each), which works through tunnels and school proxies; wrong PINs are limited
  to 15 tries per device per 10 minutes; answers stay on the teacher's computer until each reveal.

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

1. Raise `version` in `desktop/package.json` (e.g. 2.2.1).
2. `cd desktop && npm run dist` — also writes `release/latest.json`.
3. On GitHub: **Releases → Draft a new release**, tag `v2.2.1`, attach the Setup `.exe`, the Portable `.exe` and `latest.json`, **Publish**.

The tablet web app updates itself whenever `main` changes (`.github/workflows/pages.yml` rebuilds and publishes it).

## Fixing errors

1. Run `python3 build.py` then open `dist/index.html`.
2. Open the browser console. If a module failed, you'll see
   `HelixBoard: <mod>.js failed to start` — fix that file in `app/`
   and rebuild.
3. `window.__hbErr` lists any module that failed to load.

## Known limits

- Arabic handwriting recognition is not offered (the interface itself is fully Arabic: the ع button).
- The iPad version is a web app (no App Store build — that needs a Mac and an Apple developer account).
- The Windows installer is not code-signed, so SmartScreen warns on first install.
- PowerPoint animations and videos aren't captured; the slide shows its final look.
- Floating panels, the wheel screen and the on-screen keyboard are not captured in recordings.

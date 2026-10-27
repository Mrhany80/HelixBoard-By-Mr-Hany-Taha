# HelixBoard By Mr. Hany Taha — the Science Slate

Single-file interactive whiteboard for biology and science lessons.
Designed by Mr. Hany Taha for Green Hills International School (GHIS), Jeddah.

Version **2.2.0** — three ways to run it, all built from the same `app/` source:

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
**Teach** (lesson, timers, wheel and pickers, live/phone quiz, assessment, focus tools, water — filter chips) ·
**Study** (student practice tools) · **Page** (page, backgrounds, files, intro setting — filter chips).
Tab definitions live in `ui.js`: `SRC` holds every tool group, `TABS` assembles the nine tabs from them.

## Phone quiz (Windows app)

**Teach → Phone quiz (QR)** runs a quiz the way Wayground/Quizizz does: students scan the QR code on the board,
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
Upload the whole `dist/` folder to any HTTPS static host (Netlify, GitHub Pages, Cloudflare Pages, Vercel).
Students open the address once and install it (Page tab → **Install as app** shows the steps for their device).
To publish an update, rebuild and upload `dist/` again — installed copies offer **Update now** within 30 minutes or on next launch.

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

## Fixing errors

1. Run `python3 build.py` then open `dist/index.html`.
2. Open the browser console. If a module failed, you'll see
   `HelixBoard: <mod>.js failed to start` — fix that file in `app/`
   and rebuild.
3. `window.__hbErr` lists any module that failed to load.

## Known limits

- Arabic handwriting recognition is not offered (the interface itself is fully Arabic: the ع button).
- The iPad version is a web app (no App Store build — that needs a Mac and an Apple developer account).
- The Windows app updates by installing the new Setup `.exe`; the tablet web app updates itself.
- PowerPoint animations and videos aren't captured; the slide shows its final look.
- Floating panels, the wheel screen and the on-screen keyboard are not captured in recordings.

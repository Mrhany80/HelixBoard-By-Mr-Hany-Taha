# Changelog

## 2.7.1

**Leaving the app while presenting** — switching away (Alt+Tab, Windows key, another window) during a PDF or PowerPoint
share no longer leaves a pen stroke, slide click or fade "held down". On return every gesture is released and the board
repaints. The phone board stream pauses while the app is hidden and can never get stuck after a lost frame.
**Highlighter** — keeps its own thick width (no more 4 px highlighter) and is visible again on white slides and PDF pages.
**Collaborate** — every structure opens on a page of its own named after it (no more layouts piling up), and its frame is
a normal group you can move, resize or delete.
**Problem report** — if anything ever stalls, press Ctrl+Shift+D and paste the copied report in a message.

## 2.7.0

**Slides (B1)** — writing or typing on PowerPoint slides never stops the slideshow again. In 2.6.1 a text box left open after
typing made the clicker and PageDown do nothing (reproduced: 18 of 20 advances moved); now Esc closes the text box and
PageDown/PageUp close it and keep going (20 of 20 move, 1–2 ms per step). With the pen on, a click draws, so a hint says
"Pen is on: use ▶ or the arrow keys". Steps are found from the step pictures only (not every stroke), a fade cut short
finishes at once, a 0.9 s watchdog clears a stuck fade, and `window.__hbDeckLog` keeps the last 60 steps for diagnosis.

**Right-click (B2)** — one document-level handler blocks the browser menu everywhere except text fields; the radial menu
opens once per gesture (700 ms guard) for mouse, pen button and long-press, and offers Duplicate / Copy / Front / Delete for
a selection, so no second menu opens. In the slideshow a laser right-click goes back a step instead.

**Repeated tools (B3)** — no two buttons in the tabs share a label (checked at runtime over every tab). Tools moved out of
the tabs (Think-Pair-Share, T-P-S timer, Stations, Calculator in Units, Record, Animate, My quiz sets, My flashcards) keep
their ids, so docks saved with them still load every button.

**Concept map (A1)** — linking words are asked in the app (the browser prompt is blocked on many boards), Outline puts the
map beside it as an indented list (and copies it), deleting an idea from anywhere removes its branch in one Undo step.

**Collaborate tab (B4)** — new tab (10 tabs in all): ten structures (Think–Pair–Share, Jigsaw, Placemat, Gallery walk,
Carousel, Numbered heads, Four corners, Fishbowl, Six thinking hats, Group roles) placed as one Undo step with a phase-timer
bar; groups on the board, pick a group; the live sticky wall, cluster frames and dot voting. English and Arabic.

**Bubble-sheet exam (B6)** — Live class → Tests → Bubble-sheet exam. Settings first (name, class, time, number of questions,
answer types by range "21-25 TF", points, minus for a wrong answer, pass mark, what students see afterwards, sheet direction,
Arabic letters and numerals, phone language). The document (PDF, Word made into PDF in the Windows app, or photos) is shown
to students exactly as it is beside a bubble sheet (44 px bubbles, flag ★, review before handing in, timer with 5/1-minute
warnings and auto hand-in; two tabs under 900 px). The key: tap bubbles, paste "1A 2C 3B", upload a key file (the worksheet
key reader — the "optional answer-key upload" planned in 2.6.1), or read from the end of the document. Every tap is saved on
the phone and sent every 5 s; a dropped connection or a reload loses nothing. Leaving the page, leaving full screen and
copying are recorded (never blocked) and shown as ⚑ on the dashboard. Marking on the teacher's computer; the key never
reaches a phone (checked over every response). Printable A4 bubble sheet (corner marks, student-ID grid, exam code, 1–4
columns, Arabic right-to-left). Dashboard: KR-20 reliability.

**On-screen keyboard** — rebuilt: three sizes (keys 50/60/72 px tall), full English layout (number row, Tab, Caps,
both Shifts, arrows, Delete), Windows Arabic layout with its Shift layer (حركات، إ أ آ، لا لإ لأ لآ), symbols, sub/superscripts,
Greek, units, chemistry and biology layers, long-press variants, types into the board or any focused field, drag and dock.

**Logo** — Green Hills colours (green and gold) in the app, the Windows icon, the installer and the web app.

**Tests** — `tests/` is now in the repository (28 suites + fixtures). New: `ppt`, `sx`, `kb`; `mm` follows the in-app
linking-words box.

### Decisions and workarounds
- The preview build Mr. Hany supplied (v2.6.1 + B1–B4 work) was taken as the base; `dist/index.html` is byte-identical to it
  before the 2.7.0 additions. The preview had no Arabic for its new strings; 107 were added.
- B1: the overlay canvas for fades was not needed — measured frames during a fade are ~17 ms with 400 strokes on the slide
  and the key → step time is 1–2 ms; the freeze was the open text box, now fixed.
- B6 in-class mode only: answers go through the class link (LAN or quick tunnel) and HelixBoard must stay open (the settings
  screen says so).
- Not in 2.7.0, with reasons: scanning paper bubble sheets with the webcam (the printable sheet is ready for it; the scan
  needs its own accuracy work on the cards.js pipeline), the Supabase homework mode (needs a schema change on the live
  project, which Mr. Hany applies himself), A/B versions, several attempts, extra time per student, and the instant
  re-teach page. Concept-map polar/Reingold–Tilford layouts and Fishbone were not added; the existing tidy layout is kept.

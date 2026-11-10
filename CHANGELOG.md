# Changelog

## 2.8.0

One learning tool for each tab, four fixes, and Windows releases that build themselves.

### New — one tool per tab (`app/plus.js`)
**Draw → Ghost trace** — select a drawing and it becomes the model: *Trace* it while it is pale, *From memory* hides it, *Check*
brings it back in green under your own ink. The model is locked while you practise; Finish puts it back. Saved in the `.helix` file.
**Shapes → Live measure** — lengths, angles and areas appear beside lines and shapes and follow them as they are resized.
Set the scale from one object whose real size you know (a scale bar, a ruler in a photo): nm to km. Sizes can be written on the board.
**Text → Cloze** — pick the key words of any text box (or let HelixBoard suggest them) and they become blanks. A tap on the text
with any tool except Select opens the next blank. Open all, hide again, and a shuffled word bank. Arabic text works.
**Notes → Notes → quiz** — lines written as “term - definition” become a multiple-choice quiz set; the wrong answers are the other
terms from the same notes. Saved with the other quiz sets (Live quiz, Practice quiz, phones).
**Insert → Before / after** — select two pictures and compare them with a slider or a fade (mitosis stages, stained and unstained).
**Science → Lab → Mini-labs** — enzyme activity (temperature or pH, four enzymes), osmosis (plant and animal cell, with the cell
drawn beside the graph) and predator–prey. Each runs as predict → observe → explain: nothing runs until a prediction is chosen,
results arrive one noisy trial at a time, and the model line stays hidden until there are enough results. The graph and sentence
starters go onto the board.
**Teach → Lesson flow** — now also a *runway* across the top of the board (one block per phase, sized by its minutes, tap to jump),
and an option to move to the next phase by itself.
**Study → Due today** — every flashcard that is due, from every deck, in one mixed session; progress is saved in each card's own deck.
One reminder a day when cards are due.
**Collaborate → Fair talk** — tap a name each time a student contributes; a meter shows how much of the class has spoken and
*Pick a quiet voice* chooses among those who have spoken least. Uses the Cold call class list.
**Page → Lesson recap** — a new last page with the headings, key ideas and questions from every page, plus a 3-2-1 exit prompt.
Print it with Page → PDF.

### Fixed
**Tablets and phones** — below 860 px the tool panel was 262 px wide and showed three tools, the top buttons and the dock ran off
the right edge, the hidden drawer made the page wider than the screen, and on phones the two dates printed over each other.
The tool row now spans the screen and scrolls sideways, the dock and top bar stay on screen, and narrow screens put the dates on two lines.
**No internet needed** — maths equations (KaTeX and its fonts), chemistry `\ce{}`, Sketchy and Hatch shapes (Rough.js), Data → chart
(Chart.js) and molecules (SmilesDrawer) are now inside the app (+1.1 MB). Only Photo → text and handwriting → text still download on first use.
**Touch targets** — colour swatches and the page-tab close button are 28 px (were 24 and 22); sliders and the colour picker carry
their own names for screen readers.

### Releases
`.github/workflows/release.yml` — when `main` changes and `desktop/package.json` holds a version with no release yet, a Windows
runner builds the Setup and Portable `.exe`, writes `latest.json`, creates the tag and publishes the GitHub release with the notes
from this file. Publishing a version is now: raise the version, add its section here, push to `main`.

### Tests
`tests/plus.js` (51 checks, no network): every new tool, the three lab models, the offline libraries, and the layout at 768 and 390 px.

### Decisions
- “A feature for every tool” would have meant 365 additions; each new tool is attached to an existing tab and works on what is already on the board.
- Flashcards already used Leitner boxes, Lesson flow already had phase timers and Cold call already avoided repeats — these were extended, not rebuilt.
- The mini-lab questions and explanations are in English; the buttons and labels have Arabic.
- The lab models are teaching models (Q10 = 2 below the optimum, denaturation above it; isotonic point 0.3 mol/dm³; Lotka–Volterra), not data from a real experiment.

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

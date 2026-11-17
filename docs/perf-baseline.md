# Ink performance — baseline (v2.8.0, commit 03b8014)

Scenario (`node tests/inkbench.js`): headless Chrome, 3840x2160 screen, CPU slowed 4x, a board holding 2,000 strokes and
10 slide-size pictures (4.8 MB), then 20 seconds of scripted handwriting (a pen sample every 8 ms, 140 ms between strokes,
a 1.1 s pause after every 8th stroke). These numbers compare one build with another on the same machine. They are not the
touch delay of a real smartboard, which also depends on the panel's touch frame and the PC's graphics card.

| Measurement | Result | Target |
|---|---|---|
| Launch to first ink | 5230 ms | 2,000 ms |
| Stroke commit, 95th percentile (median) | 845.8 ms (4.7 ms) | 4 ms |
| Frame while writing, 95th percentile (max) | 697.5 ms (837.1 ms) | 8 ms |
| Longest main-thread task | 1020 ms | 50 ms |
| Long tasks in the run (total time) | 73 (15786 ms) | – |
| Strokes the script managed to write in 20 s | 14 | – |

## Where the time went (CPU profile of the same run)
| Cost | Cause |
|---|---|
| ~2.9 s in `drawImage` inside `drawFrame` | after every stroke the whole page was redrawn and the 4K picture copied for panning |
| ~1.4 s in `clean` ← `serial` ← `saveNow` | 800 ms after every change the board was turned to text object by object (stringify, parse, stringify) |
| ~0.25 s in IndexedDB `put` | every save rewrote all pictures, changed or not |
| ~0.5 s in `selObjs` | the concept-map module scanned every object for every pen sample |
| ~0.4 s in `renderMini` | the minimap was redrawn 500 ms after each stroke |

## Suspects, after measuring
| # | Suspect | Verdict |
|---|---|---|
| 1 | Full-page redraw after every stroke | Confirmed — the largest cost |
| 2 | Save 800 ms after each change, all pictures rewritten | Confirmed |
| 3 | Live layer cleared and rebuilt each frame | Rejected — about 1 ms per frame |
| 4 | Writing sound on every pen sample | Rejected — about 0.1 ms per sample |
| 5 | Three canvas layers at 4K | Real, but lowering the resolution would blur the ink; left as is, capped at 4K |
| 6 | Timers and listeners of closed panels | Partly — minimap, page tabs, slide thumbnails and button states ran after each stroke |
| 7 | 7.6 MB file parsed at start | Partly — start-up is 41% faster after the cut, still above target |
| new | Blurred panels over the board; a glow animation that never stops | Found in the styles; both repaint while you write |

# Ink performance — after (v3.0.0, branch lean/3.0)

Scenario (`node tests/inkbench.js`): headless Chrome, 3840x2160 screen, CPU slowed 4x, a board holding 2,000 strokes and
10 slide-size pictures (4.8 MB), then 20 seconds of scripted handwriting (a pen sample every 8 ms, 140 ms between strokes,
a 1.1 s pause after every 8th stroke). These numbers compare one build with another on the same machine. They are not the
touch delay of a real smartboard, which also depends on the panel's touch frame and the PC's graphics card.

| Measurement | Result | Target |
|---|---|---|
| Launch to first ink | 3066 ms | 2,000 ms |
| Stroke commit, 95th percentile (median) | 9.6 ms (2.9 ms) | 4 ms |
| Frame while writing, 95th percentile (max) | 1.4 ms (5.4 ms) | 8 ms |
| Longest main-thread task | 221 ms | 50 ms |
| Long tasks in the run (total time) | 25 (1705 ms) | – |
| Strokes the script managed to write in 20 s | 36 | – |

## Before and after
| Measurement | 2.8.0 | 3.0.0 |
|---|---|---|
| Launch to first ink | 5230 ms | 3066 ms |
| Stroke commit, 95th percentile | 845.8 ms | 9.6 ms |
| Frame while writing, 95th percentile | 697.5 ms | 1.4 ms |
| Longest main-thread task | 1020 ms | 221 ms |
| Time lost in long tasks | 15786 ms | 1705 ms |
| Strokes written in 20 s | 14 | 36 |

## Targets not met, and why
- **Stroke commit 9.6 ms (target 4 ms).** With the CPU slowed 4x this is about 2.4 ms on a normal PC. What is left is
  building the stroke outline and the board's own bookkeeping (undo step, template zones).
- **Longest task 221 ms (target 50 ms).** The remaining long tasks are the browser handing the 4K canvases to the
  compositor ("Commit" in the trace) on this test machine, which has no graphics card. An empty board shows the same tasks
  (144 ms), so they do not come from the board's content. A real smartboard PC with a GPU should not have them; that needs a test on the board.
- **Launch to first ink 3066 ms (target 2,000 ms).** About 0.8 s on a normal PC. The file is still 7.0 MB because the document
  libraries (PDF, PowerPoint, Word) stay inside it so the app works with no internet.

## Not measured
Touch delay on the real smartboard, the Windows installer, and sound.

# Menu changes in 3.3.0 (nothing removed)

Measured on v3.2.1 at runtime: 8 ribbon tabs (Draw 25 tools, Shapes 32, Text 20, Notes 54, Insert 11, Science 66, Teach 45, Page 35), 288 tools in tabs, 316 ids in `HBUI.ALL`. No two tools share a label (checked by `menus2.js`).

## Tabs: 8 become 5
| Old tab | Now | How |
|---|---|---|
| Draw | Draw, sub-tab Pens | unchanged tools |
| Shapes | Draw, sub-tab Shapes | same groups |
| Text | Draw, sub-tab Text | same groups |
| Insert | Insert, sub-tab Media | unchanged tools |
| Notes | Insert, sub-tab Notes | same groups |
| Science, Teach, Page | unchanged | |
A saved last-used tab (`shapes`, `text`, `notes`) opens its new home. Dock, saved boards and keyboard shortcuts are untouched.

## Simple mode (default; the "More tools" chip toggles it)
Hides 88 of 281 ribbon tools that are used rarely, group by group (`ADV` in `app/ui.js`): Draw: Options, Ink magic, Practise drawing, Measure, Arrange, Recall; Insert: Screen, Compare, Atlas apps, Thinking maps, Mark, Review, Science templates, More; Teach: Routines, Names, Wheel options, Every voice, Questioning, Signal, Motivate; Page: Look, Input, Show, Start, Background options. Every hidden tool is still found by Ctrl+K and by the "More tools" chip.

## Removed or merged tools
None yet. Candidates need the owner's eyes first (a list of near-duplicates will come with the next step). This is deliberate: the 3.0 release already removed 64 tools.

## Not done yet
A true 12-tool floating bar, contextual selection bar, searchable galleries for Science and Teach, favourites and recents.

## Merged tools (owner approved all 13 merges, "Ok merge")
Nothing was deleted. Each old tool keeps its id (saved docks still find it), stays in the Ctrl+K search, and now sits behind one button that opens a panel. Test: tests/merge.js.

| New button | Replaces (taken off the ribbon) | Reason |
|---|---|---|
| Timer | Board timer, Full screen, 5 min, 10 min, Mini timer, Think time | six buttons that all start a countdown |
| Pick a student | Open wheel, Spin now, Mini picker, Cold call, Fair talk; Edit names, New class list, Numbers 1-30, Groups 1-6, Review questions; Remove winner, Bring all back | all choose a student or set up the picker |
| Flashcards | Due today, Flashcards, Roots cards, Import a set, Flashcard sets, Cards on board, Make flashcards | flashcards were spread over three menus |
| Quiz | Live quiz, Quiz sets, Notes to quiz | one place for quizzes |
| Templates | the note templates, the science templates, All templates, Templates (Page) | three template entry points |
| Highlighter | Yellow, Green, Pink, Blue highlight | colour choice of one tool |
| Marks | Tick, Cross, Star mark, Query, Good work | five marks, one button |
| Export | PNG, PDF | save-a-copy options together |
| Settings | Smartboard, Touch test, OS ink, Pen delay, Ink speed; Intro at start, Play intro, language, Install, Updates, My account | settings do not belong in the lesson tools |
| (hidden) | Bullet lines (Text tab) | same as Bullets in Notes |

Not yet merged (next): shared colour picker (A8), one searchable backgrounds gallery (A10), single Import button (the Insert "Open PDF / Word / PPT" button already imports all three).

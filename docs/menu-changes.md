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

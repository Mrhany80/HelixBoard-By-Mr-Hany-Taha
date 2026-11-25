# Whiteboard essentials: what HelixBoard already has (checked in the code, 2026-11-25)

| Feature | Found | Where |
|---|---|---|
| Lock an object | yes, objects have a locked flag; locked items are skipped by select, erase and lasso | app/input.js (hitTop, eraser, lasso) |
| Layers | yes, three layers (Background, Content, Annotation) each with show and lock | app/input.js layerLocked; Properties panel in app/ui.js |
| Minimap and zoom | yes | app/ui.js "minimap, zoom, scrollbar" |
| Pen-only mode (palm and finger ignored) | yes, plus smartboard mode that ignores a second touch | app/ui.js 'penonly', app/input.js |
| Align, group, front/back, duplicate | yes, now also on the contextual selection bar | app/ui.js |
| Grid snap | yes | app/ui.js 'snap' |
| Ink to shape | yes | recognition in app/recog.js |
| Comments on objects | not found | candidate to add |
| Version history | not checked yet | to check |
Conclusion: the P0 list is mostly present. The remaining candidates are comments and an explicit Lock button on the selection bar (the flag exists, the one-tap button may not).

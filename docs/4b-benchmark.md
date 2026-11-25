# Active learning and note-taking benchmark (brief section 4b, step 1)

Competitor claims come only from the official pages listed, read 2026-11-25 (search excerpts; I did not read each page end to end). "HelixBoard today" comes from the menus and tests in this audit; "not checked" means not tested yet.

| Tool | What the official page says | URL |
|---|---|---|
| Kahoot | Mixed question types in one kahoot: quiz, poll, puzzle, type answer, word cloud, open-ended; true/false; teams; multi-select answers can be switched on | https://kahoot.com/schools/how-it-works/ , https://support.kahoot.com/hc/en-us/articles/115002308428-Kahoot-question-types |
| Quizlet | Spaced repetition: you rate each card and it resurfaces cards before you forget; "Learn" makes a study path from your goals | https://quizlet.com/features/spaced-repetition , https://help.quizlet.com/hc/en-us/articles/360030986971-Studying-with-Learn |
| Quizizz | Quiz maker with several question types; activities can be mixed slide by slide; free plan has limited question types | https://quizizz.com/home/quiz-maker , https://quizizz.com/home/en/product |
| Wordwall | 30+ activity types, interactive and printable versions, templates such as quiz, match up, random wheel, open the box | https://www.wordwall.net/ , https://wordwall.net/features |
| Mentimeter | Live polling with instant results; quiz slides score answers, run a countdown and show a leaderboard; question slides collect input without scoring | https://help.mentimeter.com/en/articles/6385783-what-s-the-difference-between-quiz-slides-and-question-slides |
| Blooket | Many game modes played live, solo or as homework, built on question sets | https://help.blooket.com/hc/en-us/articles/31616660563479-Blooket-Game-Mode-Previews |
| OneNote | Ink can be converted to text, shapes and math equations | https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/convert-your-ink-to-text-shape-and-math-equations |
| GoodNotes | Lasso selects handwriting, images, text boxes and stickers; search covers handwriting, typed text and PDF text | https://support.goodnotes.com/hc/en-us/articles/7353695644175-Select-Move-and-Edit-Content-With-the-Lasso-Tool , https://support.goodnotes.com/hc/en-us/articles/7353743594127-How-to-Search-Your-Notes |
| Notability | Write or type, record audio with notes, annotate PDFs, turn notes into flashcards and quizzes; customisable floating tool bar | https://notability.com/faq , https://blog.notability.com/post/how-to-get-started-with-notability |
| Apple Freeform | Boundless board with photos, drawings, links and files; share and work together | https://support.apple.com/guide/freeform/get-started-frfm85d6f7b58/mac |

## Gap table (checked against the code, 2026-11-25)
| Feature | Leaders | HelixBoard today (read in app/studio.js, app/wheel.js) | Plan |
|---|---|---|---|
| Several question types in one quiz | Kahoot, Quizizz, Wordwall | Multiple choice and "Order:" (arrange in the right order). True/false can be written as two options. No type-the-answer, no multi-select | Add type-the-answer first, then multi-select |
| Spaced repetition | Quizlet | Present: Leitner boxes, "Due today" mixes all decks, daily reminder. Parity | Keep |
| Rate each card (know / unsure) | Quizlet | Exists (known and seen counts feed progress) | Keep |
| Timer, points, leaderboard | Mentimeter, Kahoot | Present: per-question countdown (Off to 120 s, ticks in the last 5 s, auto-reveal), team points, winners, paper answer cards read by camera, results to Reports. Parity or ahead for a one-board classroom | Keep |
| Random wheel, no repeats, saved class lists | Wordwall | Present: wheel removes winners, saved named lists, Arabic names, spin time | Parity, nothing to build |
| Match-up, open-the-box style activities | Wordwall, Blooket | Not offered | Candidate after the items above |
| Ink to text / math | OneNote | Ink to shapes exists; ink to text was removed in 3.0 (large model) | Keep removed unless a small offline method is found |
| Notes to flashcards and quizzes | Notability | Both exist ("Make flashcards", "Notes to quiz") | Keep |
| Search across notes | GoodNotes | Not found in app/notes.js | Add typed-text search in the notes list |
| Audio with notes | Notability | Not offered (removed for ink speed) | Leave out |

# Security review (H1, H5, M1) - 3.3.0 audit

Method: read the code and the SQL; searched every `innerHTML` use (about 140 across 25 files) for page text or server data put in without `esc()`. Nothing was run against the live Supabase project. No finding below is a confirmed break-in path; they are risks to decide on.

## H1: HTML injection through innerHTML
- Heuristic scan for user-controlled fields (names, labels, text, titles, school, email) added to `innerHTML` without `esc()`: 2 hits, both are fixed tab names (safe).
- account.js (the only place that shows other people's server data, the admin list): every name, school, grade and email goes through `esc()`.
- Result: no injection found. Risk that remains: there is no Content-Security-Policy, so one future mistake would run script with full access to the board and the saved login. Suggestion: add a CSP meta tag (`default-src 'self'`; allow the Supabase host in `connect-src`; keep `'unsafe-inline'` for now because the app is one inline file). Not done here because it can break the single-file build and needs testing on the real Windows app.

## H5: Auto-updater (desktop/updater.js)
Good: HTTPS only; version must look like x.y.z; the installer's SHA-256 is checked before it runs; the user is asked first; "Skip this version" works; portable copies only open the web page.
Risks:
1. The checksum comes from `latest.json` in the same GitHub release as the installer. It catches a broken download, not a malicious release. Anyone who can publish a release on the repo (stolen password or token) can ship a program to every school computer.
2. The installer is not code-signed (`signAndEditExecutable: false`). Windows SmartScreen will warn, and nothing proves who made it.
3. `fetch` has no timeout, so a stalled download leaves the progress bar on until the app is restarted.
4. The temp file is not deleted after install.
Suggestions (owner decision, they cost money or setup): turn on two-step login for the GitHub account; protect the main branch; consider a code-signing certificate. Code fix for 3 and 4 is small and can be done on request.

## M1: Supabase schema (supabase/schema.sql)
Good: row-level security is on for all three tables; people read and write only their own rows; the admin check is a server function; the role cannot be changed by the user (trigger `protect_profile`); sign-up cannot create an admin; admin functions are not callable by anonymous users; every security-definer function pins `search_path`.
Risks (low to medium):
1. Anyone can sign up as "teacher" (the role is taken from what the app sends). If teacher rights ever unlock anything, that needs approval first.
2. `username_available` is open to anonymous callers, so usernames can be listed one by one. Low.
3. Minimum password length is 6.
4. `activity` and `quiz_results` accept unlimited inserts per user, so a bad client could fill the database. Suggest a daily row limit per user.
5. The tables hold pupils' school, grade and e-mail. Check Green Hills' child-data rules and tell families what is stored. Not a code problem.
No schema was changed (the brief says Supabase stays as it is).

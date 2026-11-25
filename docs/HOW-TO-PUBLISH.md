# Publishing the HelixBoard branch (checkpoint 1)

Contents: small commits on branch `audit/pro-overhaul` (safety fixes, five-tab menu with Simple mode, import fixes, tests, docs; see docs/v3.3.0-audit.md and docs/menu-changes.md).

## Option 1: git (recommended)
1. In a folder with your clone of the repo: `git pull` on main.
2. `git fetch /path/to/helixboard-audit-pro-overhaul.bundle audit/pro-overhaul:audit/pro-overhaul`
3. Check it: `git log main..audit/pro-overhaul`, then `python3 build.py` and run the tests (`cd tests && node runall.js`).
4. Push the branch (NOT main): `git push origin audit/pro-overhaul`
5. On GitHub open a Pull Request from audit/pro-overhaul into main. Do not merge until you have tested it: merging to main with a new version number publishes a Windows release automatically. These commits do not change the version.

## Option 2: GitHub web upload
Unzip the zip, open the repo on GitHub, create a branch named audit/pro-overhaul, use "Add file > Upload files" for the changed files (the files listed by `git diff --stat main..audit/pro-overhaul`), commit to that branch, then open a Pull Request.

## Final step: a deliberate release (only when you are happy with the app)
The release is automatic by design: any push to main whose version number has no release yet builds and publishes the Windows app. So it only happens when YOU decide, in this order:
1. Test the Pull Request build first (Actions tab > the run for your branch must be green; open the app and try it).
2. Choose the new version: edit "version" in desktop/package.json and app/account.js (same number), and add a "## <version>" section to CHANGELOG.md. Commit that on the branch. I do not change the version myself.
3. Merge the Pull Request into main (green "Merge pull request" button). This is the moment the release starts. Merging without raising the version publishes nothing new.
4. Watch it: GitHub > Actions > "Windows release". It takes several minutes. If it fails, nothing is published; fix and use "Run workflow" to retry.
5. Your download links appear on your repo page, on the right under "Releases", or at https://github.com/Mrhany80/HelixBoard-By-Mr-Hany-Taha/releases . Each release lists the Setup .exe (installer) and the Portable .exe. Installed copies update themselves from that release.
Never push a tag by hand; the workflow creates the tag v<version> itself.

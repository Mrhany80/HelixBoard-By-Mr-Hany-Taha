# Publishing HelixBoard 4.0 (3 commands, then 2 clicks)

The finished work is the branch `audit/pro-overhaul` (39 small commits, version already set to 4.0.0). Nothing is published until YOU press "Merge" in step 5.

## 1. Get the branch into your copy of the repo (open Terminal / PowerShell in your HelixBoard folder)
```
git checkout main
git pull
git fetch "C:\path\to\helixboard-audit-pro-overhaul.bundle" audit/pro-overhaul:audit/pro-overhaul
```
(Replace the path with where you saved the .bundle file.)

## 2. Send the branch to GitHub (this does NOT publish anything)
```
git push origin audit/pro-overhaul
```
Sign in the normal way when it asks (browser window, or your username and a personal access token). Do not type your account password into git, GitHub will refuse it.

## 3. Open the Pull Request
On github.com/Mrhany80/HelixBoard-By-Mr-Hany-Taha click "Compare & pull request" for audit/pro-overhaul, base: main, then "Create pull request".

## 4. Wait for the green ticks (about 15 to 25 minutes)
Two checks run by themselves: "Tests" (browser tests) and "Windows app check" (starts the real Windows app and taps every tool). Both are read-only and cannot publish. If one is red, do not merge: send me the link.

## 5. Release (the deliberate step)
When both are green, click "Merge pull request". Because the version is 4.0.0 and there is no release for it yet, the "Windows release" workflow starts and builds the Setup and Portable apps. It takes several minutes (GitHub > Actions > "Windows release").
Your download links then appear at:
https://github.com/Mrhany80/HelixBoard-By-Mr-Hany-Taha/releases
(also on the repo home page, right side, under "Releases"). Installed copies update themselves from that release.

Notes
- Never create a tag by hand. The workflow creates v4.0.0 itself.
- To rebuild an existing release: Actions > "Windows release" > Run workflow (this overwrites that release's files, so only do it on purpose).
- Fallback if git is difficult: unzip helixboard-audit-pro-overhaul-tree.zip over a fresh clone on a new branch, commit and push that branch, then continue from step 3.

# Release Runbook

Use this checklist for every versioned release. Daily work lands on `develop`
and is pushed after each commit. Releases are validated on `develop`, merged
fast-forward to `main` for deployment, and identified by an annotated `vX.Y.Z`
tag. GitHub Release creation is a separate final step.

## 1. Prepare the repository

1. Confirm the intended version and title from the matching release plan.
2. Start from a clean, current `develop`:

   ```bash
   git status -sb
   git switch develop
   git pull --ff-only origin develop
   gh auth status
   ```

3. If `gh auth status` reports an invalid or missing token, run
   `gh auth login -h github.com` before release work. The repository connector
   does not create GitHub Releases, and browser access may be unavailable, so
   the authenticated GitHub CLI is the supported publication path.
4. Verify that `vX.Y.Z` does not already exist locally or remotely:

   ```bash
   git tag --list vX.Y.Z
   git ls-remote --tags origin vX.Y.Z
   ```

## 2. Commit implementation work in small chunks

Commit each independently reviewable change as it becomes complete. Keep tests
with the behavior they cover, but do not run the test suite during iterative
implementation. Run `npm run lint:working-tree` while working; it lints changed
and untracked JavaScript/TypeScript files and checks changed folder sizes. Push
each non-release commit to `origin/develop` so the shared branch stays current.
Reserve the full lint, typecheck, build, and test gates for the final release
checkpoint, with `npm test` run immediately before the release commit.

Stage explicit paths, inspect the staged diff, and then commit:

```bash
git add -- path/to/file path/to/test
git diff --cached --check
git diff --cached --stat
git commit -m "type(scope): concise description"
```

Do not stage files that only appear modified because of line-ending or
timestamp metadata. `git diff -- path/to/file` must show real content changes.

## 3. Write the release notes

Add `docs/releases/vX.Y.Z.md` with this exact shape:

```markdown
---
version: X.Y.Z
date: YYYY-MM-DD
title: Release Title
---

## Added

- Player-facing addition.

## Changed

- Player-facing change.

## Removed

- Player-facing removal.

## Fixed

- Player-facing fix.
```

All four sections must exist and contain at least one item. Keep public notes
plain-language and player-facing. Put implementation details inside the
supported developer-only block when useful:

```markdown
<!-- developer-only -->
- Internal implementation detail.
<!-- /developer-only -->
```

If a matching plan exists, mark it `Status: Released YYYY-MM-DD`, then move it
from `docs/releases/` to `docs/archive/`. Keep the release notes in
`docs/releases/`.

## 4. Synchronize the version

Change the version in all five release-locked manifests:

- `package.json`
- `packages/client/package.json`
- `packages/content/package.json`
- `packages/engine/package.json`
- `packages/game-server/package.json`

Update the root and four workspace records in `package-lock.json`. Do not alter
third-party package versions that happen to match the old game version, and do
not change the independently versioned `tools/package.json`.

Also update:

- `packages/client/src/appVersion.ts`
- version inputs and assertions in
  `packages/client/src/releaseNotesDevRoute.test.ts`

Review `git diff -- package-lock.json` to confirm only the root and workspace
package records changed.

## 5. Run the release gate

Run the complete non-browser gate at the final pre-commit/release checkpoint,
with tests last immediately before committing the release work and then tagging
it:

```bash
npm run lint
npm run typecheck
npm run build
npm test
git diff --check
git status -sb
```

The Playwright E2E suite was removed in v0.5.0. Do not reinstall browsers or
add an E2E command to the release gate. Perform any release-specific manual
playtest required by the plan and record the result in the task or release
notes.

The production build must contain `releases/vX.Y.Z.html` and list it from
`releases/index.html`.

## 6. Commit and start deployment

Commit the notes and synchronized version separately from implementation work on
`develop`:

```bash
git add -- docs/releases/vX.Y.Z.md docs/releases/vX.Y.Z-plan.md \
  docs/archive/vX.Y.Z-plan.md \
  package.json package-lock.json packages/*/package.json \
  packages/client/src/appVersion.ts \
  packages/client/src/releaseNotesDevRoute.test.ts
git diff --cached --check
git commit -m "chore(release): prepare vX.Y.Z"
```

Create an annotated local tag using the established title format, then push
the release merge to `main` without pushing the tag yet:

```bash
git tag -a vX.Y.Z -m "DungeonCrawler2D vX.Y.Z - Release Title"
git push origin develop
git switch main
git pull --ff-only origin main
git merge --ff-only develop
git push origin main
git switch develop
```

The `main` push starts the production deployment. Keeping the tag local until
that exact commit deploys successfully prevents a failed deployment from
appearing as a published release.

## 7. Verify production, then publish the release

Find the production workflow run whose `headSha` equals `git rev-parse HEAD`:

```bash
git rev-parse HEAD
gh run list \
  --workflow deploy-production.yml \
  --commit RELEASE_COMMIT_SHA \
  --limit 1
gh run watch RUN_ID --exit-status
```

Do not publish the tag or GitHub Release until that run completes successfully,
including its live smoke test. If deployment fails, delete the local tag with
`git tag -d vX.Y.Z`, fix the problem in a new commit, rerun the release gate,
and recreate the local tag at the corrected commit.

The repository note contains front matter and may contain developer-only
content. Do not pass it directly to `gh release create`. Create a temporary
player-facing body that strips both:

```powershell
$source = Get-Content -Encoding UTF8 -Raw "docs/releases/vX.Y.Z.md"
$body = $source `
  -replace '(?s)\A---\r?\n.*?\r?\n---\r?\n', '' `
  -replace '(?s)<!-- developer-only -->.*?<!-- /developer-only -->\s*', ''
$releaseBody = Join-Path $env:TEMP "dungeoncrawler2d-vX.Y.Z-release.md"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($releaseBody, $body, $utf8NoBom)
```

Inspect the temporary file and confirm that it begins with `## Added`, contains
only the four player-facing sections, and contains no `version:`,
`developer-only`, or internal bullets. Then push the tag and create the GitHub
Release:

```bash
git push origin vX.Y.Z
gh release create vX.Y.Z \
  --verify-tag \
  --title "DungeonCrawler2D vX.Y.Z - Release Title" \
  --notes-file PATH_TO_SANITIZED_RELEASE_BODY
```

Then verify all published references:

```bash
gh release view vX.Y.Z
git ls-remote origin refs/heads/main refs/tags/vX.Y.Z
```

Do not move or replace a published release tag. Fix post-release problems with
a follow-up commit and patch version. Current production recovery procedures
and limitations are in [OPERATIONS.md](OPERATIONS.md).

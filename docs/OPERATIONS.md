# Production Operations

Production deploys run on every push to `main`. The workflow validates, builds,
uploads `packages/game-server/dist/main.cjs`, synchronizes the client build to
the frontend bucket, restarts the game service, invalidates CloudFront, and
smoke-tests the live release.

The operator checklist for preparing versions, writing release notes, tagging,
pushing, and creating the GitHub Release is in [RELEASING.md](RELEASING.md).

## Current rollback limitation

The current workflow overwrites the live server bundle and frontend tree. It
does not retain SHA-addressed deployment artifacts, advance a
`releases/current.json` manifest, or automatically restore the previous
release. A failure after upload can therefore leave production partially
updated until another successful deployment completes.

Do not claim that a release is live, push its version tag, or create its GitHub
Release until the exact deployment run has completed its production smoke test.

## Recovery after a failed deployment

Create a new recovery commit on `develop`, validate it there, then fast-forward
merge it into `main` and push so the normal workflow rebuilds and republishes
both targets. Use `git revert` for a bad change when practical; do not
force-push `main`, move a published tag, or rewrite released history.

```bash
git switch develop
git revert BAD_COMMIT
git push origin develop
git switch main
git pull --ff-only origin main
git merge --ff-only develop
git push origin main
git switch develop
```

Watch that deployment with `gh run watch RUN_ID --exit-status`. If the workflow
cannot run or production is unavailable, stop and coordinate AWS access with an
operator; there is no safe repository-only command that restores an immutable
previous artifact today.

## Player-data backups

Player data resides on the encrypted production instance volume. AWS Backup
captures that instance into a dedicated vault every day and retains recovery
points for 35 days. Application rollback deliberately does not roll player data
backward.

A production-readiness review must still record a successful restore drill. The
drill restores to a replacement instance, validates the versioned player store,
runs the production smoke command against the replacement, and destroys the
replacement only after the evidence has been retained.

## Monitoring

The production instance ships its server log to
`/dungeoncrawler2d/prod/server` in CloudWatch Logs with 30-day retention. The
production dashboard shows CPU and network traffic alongside a recent-error
query. High CPU and failed EC2 status checks have dedicated alarms.

An operator must attach the alarms to the team's paging destination before the
public-release gate. Terraform intentionally does not guess an email, phone
number, or incident-management service.

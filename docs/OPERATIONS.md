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
`/dungeoncrawler2d/prod/server` in CloudWatch Logs. Retention is configured by
`server_log_retention_days` and defaults to 14 days. The production dashboard
shows CPU, network traffic, the structured server-error metric, and a
recent-error query. High CPU, failed EC2 status checks, and structured server
errors have dedicated alarms.

An operator must attach the alarms to the team's paging destination before the
public-release gate. Terraform intentionally does not guess an email, phone
number, or incident-management service.

## Connection and administrative history

The server writes sanitized connection, admin, security, and server lifecycle
events to the Terraform-managed DynamoDB operational-history table. It uses
on-demand capacity, encryption, point-in-time recovery, and per-event TTL;
retention defaults to 365 days. Each new event gets its own fresh expiration,
so annual activity keeps recent history available while older events still age
out. Query a player through its actor key, or use the `by_time`
index with a UTC date partition (`YYYY-MM-DD`) for an incident window. The EC2
role has `PutItem` access only, so queries require an operator identity with
explicit read access.

Connection events retain join/resume state and close reason. Repeated anonymous
peers can be correlated by a deployment-keyed one-way fingerprint, but the raw
network address and key are never stored in the table or logs. Admin events
retain success/failure, command type, and bounded target IDs.

This table is operational history, not player persistence. Player profiles live
in `/var/lib/dungeoncrawler2d/players.json` on the EC2 volume and are covered by
the separate backup policy above; DynamoDB event expiration does not remove a
character or its saved state.

Treat `operational_event_write_failed` and `operational_event_dropped` records
as monitoring failures: gameplay continues, but some history may be missing.
Treat `server_error` as an application incident and use its source, error name,
message, bounded stack, and surrounding timeline. Verify the Terraform apply
and alarm notification target before claiming production history or paging is
active.

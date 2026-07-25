# Production Operations

Production releases are immutable artifacts addressed by the Git commit SHA.
The deploy workflow uploads the server bundle, complete client build, and a JSON
manifest before changing either live target. `releases/current.json` advances
only after the two-renderer smoke test succeeds.

## Automatic rollback

If activation, restart, edge invalidation, or smoke testing fails and a previous
release exists, the workflow restores that release's server bundle and client
tree, restarts the game service, and invalidates CloudFront.

The rollback step deliberately does not advance `releases/current.json`, so the
last known-good SHA remains the recovery source.

## Manual rollback

Set `SHA` to a previously published release and run the following with production
AWS credentials:

```bash
aws s3 cp \
  "s3://$ARTIFACT_BUCKET/server/releases/$SHA/main.cjs" \
  "s3://$ARTIFACT_BUCKET/server/main.cjs"
aws s3 sync \
  "s3://$ARTIFACT_BUCKET/client/releases/$SHA" \
  "s3://$FRONTEND_BUCKET" --delete
```

Restart `dungeoncrawler2d` through SSM, invalidate the CloudFront distribution,
and run `node tools/smoke-production.mjs "$SITE_URL"`.

## Current limitation

Player data still resides on the production instance volume. A release rollback
does not roll player data backward. Off-host backups and a practiced restore
procedure remain mandatory before the public-release gate can pass.

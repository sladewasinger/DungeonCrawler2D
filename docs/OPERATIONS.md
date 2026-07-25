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

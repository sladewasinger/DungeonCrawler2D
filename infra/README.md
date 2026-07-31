# AWS deployment

This stack owns `dungeoncrawl2d.austinwasinger.com` independently from the main website:

- a private S3 bucket and CloudFront origin for the client;
- an EC2 `t4g.nano` authoritative game server managed through SSM;
- an Elastic IP used by CloudFront as the private-facing WebSocket origin;
- ACM TLS for the public hostname;
- a `/ws*` CloudFront behavior for secure same-host WebSocket connections.
- a DynamoDB operational-history table for sanitized connection and admin/security events;
- structured CloudWatch error logs, a server-error metric, and a production dashboard.

The EC2 security group accepts port 8081 only from AWS's CloudFront origin-facing managed prefix list. There is no SSH ingress.

## Prerequisites

1. Terraform 1.10 or newer.
2. An authenticated AWS CLI profile named `poweraccess-terraform`.
3. A production build at `packages/client/dist` and `packages/game-server/dist/main.cjs`.

The profile must be able to read the existing S3 backend and manage every resource in this stack. AWS's managed `PowerUserAccess` policy deliberately excludes IAM administration, but this stack owns EC2 and GitHub deployment roles. Use an AdministratorAccess permission set or a custom permission set that also grants the required IAM role and policy operations. Changing the local profile name does not change its AWS permissions.

Authenticate and confirm the account before running Terraform:

```powershell
aws sso login --profile poweraccess-terraform
aws sts get-caller-identity --profile poweraccess-terraform
Set-Location infra
terraform init -reconfigure
terraform validate
terraform plan
```

```bash
aws sso login --profile poweraccess-terraform
aws sts get-caller-identity --profile poweraccess-terraform
cd infra
terraform init -reconfigure
terraform validate
terraform plan
```

`terraform init -reconfigure` reconnects the checkout to the existing remote state; it does not create, replace, or apply infrastructure.

The production world seed is `austin-dungeon-prod-1`. Keep that value explicit
in `terraform.tfvars`; changing it generates a new deterministic world around
persisted players and must be treated as a gameplay migration.

## Safe server changes

Production player state currently lives at
`/var/lib/dungeoncrawler2d/players.json` on the EC2 root volume. Terraform
therefore protects the existing instance from destruction and ignores routine
drift in its moving Amazon Linux AMI lookup and bootstrap `user_data`. A normal
plan must never replace `aws_instance.game_server`.

Terraform applies server runtime configuration through the
`aws_ssm_association.game_server_runtime` association instead. That association
updates the systemd unit and CloudWatch agent on the existing instance, then
restarts the service without changing the instance ID, root volume, or Elastic
IP. A future AMI migration must first move player persistence off the ephemeral
instance lifecycle and use a separately reviewed replacement procedure.

For a deliberate AMI rotation:

1. Confirm AWS Backup has a successful recovery point for the instance and
   take an additional EBS snapshot immediately before the maintenance window.
2. Copy and verify `/var/lib/dungeoncrawler2d/players.json` outside the instance,
   or migrate player storage to a separately managed persistent data service or
   volume.
3. Add the replacement instance as a separate Terraform resource. Restore the
   data and validate the game server before changing the Elastic IP association.
4. Cut over the Elastic IP during a scheduled maintenance window, verify the
   public WebSocket path, and keep the old instance stopped but intact until the
   restored server and backup are verified.
5. Remove the old resource and its `prevent_destroy` protection only in the
   separately reviewed cleanup plan.

Never remove `prevent_destroy` merely to make a routine plan succeed.

Before every production apply, save and inspect a plan:

```powershell
terraform plan -out=tfplan
terraform show -no-color tfplan
```

```bash
terraform plan -out=tfplan
terraform show -no-color tfplan
```

Stop if the plan contains a replacement, destroy, unexpected world-seed
change, instance-ID change, root-volume change, or Elastic IP reassociation.

## Phase 1: certificate and server

```powershell
npm run build
Copy-Item infra/terraform.tfvars.example infra/terraform.tfvars
Set-Location infra
terraform init -reconfigure
terraform apply -var="enable_distribution=false"
terraform output -json acm_validation_records
```

Add the emitted ACM CNAME at Namecheap and wait for the certificate to become issued.

## Phase 2: CloudFront

```powershell
terraform apply
terraform output cloudfront_domain_name
```

At Namecheap, create a CNAME with host `dungeoncrawl2d` and the emitted CloudFront domain as its value.

## Publish the client

```powershell
$bucket = terraform output -raw frontend_bucket_name
$distribution = terraform output -raw cloudfront_distribution_id
aws s3 sync ../packages/client/dist "s3://$bucket" --delete --profile poweraccess-terraform
aws cloudfront create-invalidation --distribution-id $distribution --paths "/*" --profile poweraccess-terraform
```

## Publish a new server build

Run the build and `terraform apply` to update the versioned S3 artifact, then restart through SSM. The service downloads the current artifact before every start.

```powershell
$instance = terraform output -raw game_server_instance_id
aws ssm send-command --instance-ids $instance --document-name AWS-RunShellScript --parameters 'commands=["systemctl restart dungeoncrawler2d"]' --profile poweraccess-terraform --region us-east-1
```

## Automated production releases

Terraform provisions a least-privilege GitHub OIDC role for `sladewasinger/DungeonCrawler2D`. The `Deploy production` GitHub Actions workflow runs on every push to `main` (or manually through `workflow_dispatch`) and performs the application release as one guarded operation:

1. install, type-check, test, and build;
2. publish the server bundle and client;
3. restart the EC2 service through SSM and require `active` status;
4. invalidate and wait for CloudFront;
5. join both Dungeon and Sandbox against the public WebSocket endpoint.

The server S3 object is bootstrapped by Terraform but ignores subsequent artifact-content changes. GitHub Actions owns those releases so an infrastructure apply cannot roll application code backward.

## Operational history and incident debugging

Terraform creates an on-demand DynamoDB table with AWS-managed encryption, point-in-time recovery, and TTL. It stores bounded, sanitized connection lifecycle records (open, join, close, including idle and protocol terminations) plus admin authentication and command audit events. It never stores admin tokens, admin-session continuation keys, raw IP addresses, forwarded-header chains, chat text, or raw WebSocket payloads.

Connection records use a one-way HMAC peer fingerprint for anonymous sockets. On first boot, user data creates its non-empty HMAC secret under `/var/lib/dungeoncrawler2d/operational-events.env`; it persists on the encrypted instance volume and is regenerated if malformed. It is not a Terraform input, state value, or EC2 user-data value. If production persistence is configured without that secret, the server refuses to start rather than record uncorrelatable history.

Use the table's primary key (`actor_key`, `event_key`) to inspect a player or anonymous peer's timeline. Use the `by_time` index with a UTC `time_partition` such as `2026-07-30` to inspect chronological events without creating a hot global partition. Each event receives its own `expires_at` timestamp and expires after `operational_event_retention_days` (365 by default). New activity creates a fresh event with a fresh one-year lease, so a player active at least annually retains recent connection history while older individual events still age out. DynamoDB TTL removal is asynchronous.

This operational table is not the player-profile store and its TTL does not delete player characters. Production profiles still live in `/var/lib/dungeoncrawler2d/players.json` on the EC2 volume and are protected by the separate EBS/AWS Backup policy described above.

CloudWatch retains structured JSON logs for `server_log_retention_days` (14 by default). Fatal, unhandled, WebSocket-server, and individual WebSocket transport errors use `level: error`, `eventType: server_error`, a bounded message, and sanitized stack frames. The `DungeonCrawler2D/Server` `ServerErrors` metric and dashboard surface those errors. CloudWatch is the detailed error store; DynamoDB is the durable, queryable activity index.

The EC2 role may only write (`dynamodb:PutItem`) to this table. CloudFront is the only network path to the WebSocket origin, and production enables `TRUST_PROXY=1`; the server uses CloudFront's rightmost appended viewer address for rate limits, while never logging the original header chain.

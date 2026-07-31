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
2. An authenticated AWS CLI profile named `terraform`.
3. A production build at `packages/client/dist` and `packages/game-server/dist/main.cjs`.

## Phase 1: certificate and server

```powershell
npm run build
Copy-Item infra/terraform.tfvars.example infra/terraform.tfvars
Set-Location infra
terraform init
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
aws s3 sync ../packages/client/dist "s3://$bucket" --delete --profile terraform
aws cloudfront create-invalidation --distribution-id $distribution --paths "/*" --profile terraform
```

## Publish a new server build

Run the build and `terraform apply` to update the versioned S3 artifact, then restart through SSM. The service downloads the current artifact before every start.

```powershell
$instance = terraform output -raw game_server_instance_id
aws ssm send-command --instance-ids $instance --document-name AWS-RunShellScript --parameters 'commands=["systemctl restart dungeoncrawler2d"]' --profile terraform --region us-east-1
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

Use the table's primary key (`actor_key`, `event_key`) to inspect a player or anonymous peer's timeline. Use the `by_time` index with a UTC `time_partition` such as `2026-07-30` to inspect chronological events without creating a hot global partition. Records expire after `operational_event_retention_days` (90 by default); DynamoDB TTL removal is asynchronous.

CloudWatch retains structured JSON logs for `server_log_retention_days` (90 by default). Fatal, unhandled, WebSocket-server, and individual WebSocket transport errors use `level: error`, `eventType: server_error`, a bounded message, and sanitized stack frames. The `DungeonCrawler2D/Server` `ServerErrors` metric and dashboard surface those errors. CloudWatch is the detailed error store; DynamoDB is the durable, queryable activity index.

The EC2 role may only write (`dynamodb:PutItem`) to this table. CloudFront is the only network path to the WebSocket origin, and production enables `TRUST_PROXY=1`; the server uses CloudFront's rightmost appended viewer address for rate limits, while never logging the original header chain.

# AWS deployment

This stack owns `dungeoncrawl2d.austinwasinger.com` independently from the main website:

- a private S3 bucket and CloudFront origin for the client;
- an EC2 `t4g.nano` authoritative game server managed through SSM;
- an Elastic IP used by CloudFront as the private-facing WebSocket origin;
- ACM TLS for the public hostname;
- a `/ws*` CloudFront behavior for secure same-host WebSocket connections.

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

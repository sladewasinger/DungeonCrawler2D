# AWS Static Frontend Infrastructure (`infra/`)

Terraform configuration owning the static client CDN stack for `dungeoncrawl2d.austinwasinger.com`:
- **S3 + CloudFront + ACM + GitHub OIDC**: Hosts `packages/client/dist` (`max-age=31536000,immutable` on hashed JS/CSS/WebP assets, `no-cache` on `index.html` and manifest), terminates TLS via ACM, and grants least-privilege deploy credentials to `.github/workflows/deploy-production.yml`.
- **Game Server Endpoint**: Active multiplayer simulation runs on **Fly.io (`dfw`)** at `wss://ws.dungeoncrawl2d.austinwasinger.com/ws` when `FLY_API_TOKEN` is configured (see [`docs/FLY-DEPLOYMENT.md`](../docs/FLY-DEPLOYMENT.md)).

## Validation & Manual Publish
Requires Terraform `>= 1.10` and an authenticated AWS CLI profile:

```powershell
Set-Location infra
terraform init -reconfigure
terraform validate
terraform plan -out=tfplan
```

## Legacy EC2 Fallback & Retirement
`infra/` retains legacy EC2 (`t4g.nano`), SSM parameter (`/dungeoncrawler2d/prod/admin-token`), DynamoDB operational audit table, and CloudWatch resources for fallback when `FLY_API_TOKEN` is unset. Never remove `prevent_destroy` without first backing up any EC2 persistence volume state.

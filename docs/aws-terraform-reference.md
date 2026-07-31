# WSL & Terraform Fast-Reference Sheet

## 1. Re-Authenticating AWS SSO (When Token Expires)
Run this command to refresh your local short-lived credentials session via your browser:
```bash
aws sso login --profile WSL-Austin-PC
```
*Note: Your `main.tf` provider block should reference this profile directly:*
```hcl
provider "aws" {
  region  = "us-east-1"
  profile = "WSL-Austin-PC"
}
```

## 2. Fixing "Malformed entry / etc/apt" Installs
If your package manager locks up during a fresh setup, wipe the corrupted source file and restart cleanly:
```bash
# Clear the broken repo entry
sudo rm -f /etc/apt/sources.list.d/hashicorp.list

# Fetch essential utilities first
sudo apt-get update && sudo apt-get install -y gnupg lsb-release

# Add the official key and repo cleanly
curl -fsSL https://hashicorp.com | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://hashicorp.com \$(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list

# Run the target installs
sudo apt-get update && sudo apt-get install -y terraform awscli
```

## 3. Core "PowerUser" Custom Inline Policy (IAM 403 Fix)
Attach this inline policy payload to your **AWS IAM Identity Center Permission Set** to allow your restricted CLI/AI to securely manage project security roles without giving full Root/Admin access:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowTerraformToManageDungeonCrawlerRoles",
            "Effect": "Allow",
            "Action": [
                "iam:GetRole",
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:UpdateRole",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PassRole"
            ],
            "Resource": [
                "arn:aws:iam::510682130762:role/dungeoncrawler2d-prod-github-actions-deploy",
                "arn:aws:iam::510682130762:role/dungeoncrawler2d-prod-instance"
            ]
        }
    ]
}
```

## 4. Quick Sanity Verification Checks
```bash
terraform -version  # Verify binary link
aws --version        # Check CLI wrapper path
aws sts get-caller-identity --profile WSL-Austin-PC # Inspect active token context
```

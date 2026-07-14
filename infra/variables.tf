variable "aws_region" {
  description = "AWS region for the game server and buckets. CloudFront certificates must remain in us-east-1."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = var.aws_region == "us-east-1"
    error_message = "This stack currently requires us-east-1 so its ACM certificate is valid for CloudFront."
  }
}

variable "aws_profile" {
  description = "Local AWS profile used by Terraform."
  type        = string
  default     = "terraform"
}

variable "domain_name" {
  description = "Public game hostname."
  type        = string
  default     = "dungeoncrawl2d.austinwasinger.com"
}

variable "instance_type" {
  description = "ARM Graviton instance type for the authoritative server."
  type        = string
  default     = "t4g.nano"
}

variable "world_seed" {
  description = "Deterministic production world seed."
  type        = string
  default     = "austin-dungeon-prod-1"

  validation {
    condition     = can(regex("^[A-Za-z0-9._-]+$", var.world_seed))
    error_message = "world_seed may only contain letters, numbers, periods, underscores, and hyphens."
  }
}

variable "enable_distribution" {
  description = "Create CloudFront after the ACM validation CNAME has been added at Namecheap."
  type        = bool
  default     = true
}

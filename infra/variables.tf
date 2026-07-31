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
  default     = "dungeon-test-1"

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

variable "operational_event_retention_days" {
  description = "How long sanitized connection and admin/security records remain queryable in DynamoDB."
  type        = number
  default     = 90

  validation {
    condition     = var.operational_event_retention_days >= 7 && var.operational_event_retention_days <= 365
    error_message = "operational_event_retention_days must be between 7 and 365."
  }
}

variable "server_log_retention_days" {
  description = "How long structured server logs remain in CloudWatch Logs."
  type        = number
  default     = 90

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365], var.server_log_retention_days)
    error_message = "server_log_retention_days must be a supported CloudWatch Logs retention period."
  }
}

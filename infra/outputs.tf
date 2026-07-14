output "acm_validation_records" {
  description = "Add these CNAME records at Namecheap after the first apply."
  value = {
    for option in aws_acm_certificate.frontend.domain_validation_options : option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
}

output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.id
}

output "artifact_bucket_name" {
  value = aws_s3_bucket.artifacts.id
}

output "game_server_instance_id" {
  value = aws_instance.game_server.id
}

output "game_server_public_ip" {
  value = aws_eip.game_server.public_ip
}

output "cloudfront_distribution_id" {
  value = try(aws_cloudfront_distribution.frontend[0].id, null)
}

output "cloudfront_domain_name" {
  description = "After enabling the distribution, point the Namecheap dungeoncrawl2d CNAME here."
  value       = try(aws_cloudfront_distribution.frontend[0].domain_name, null)
}

output "site_url" {
  value = var.enable_distribution ? "https://${var.domain_name}" : null
}

output "github_actions_deploy_role_arn" {
  value = aws_iam_role.github_actions_deploy.arn
}

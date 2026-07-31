data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ssm_parameter" "amazon_linux_2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

locals {
  name                                = "dungeoncrawler2d-prod"
  artifact_bucket_name                = "dungeoncrawler2d-artifacts-${data.aws_caller_identity.current.account_id}"
  server_bundle_source                = "${path.module}/../packages/game-server/dist/main.cjs"
  server_bundle_object                = "server/main.cjs"
  frontend_origin_id                  = "frontend"
  game_server_origin_id               = "game-server"
  production_distribution_id          = "E253TI6NRUSHMS"
  operational_event_retention_seconds = var.operational_event_retention_days * 24 * 60 * 60
  game_server_runtime_configuration = templatefile("${path.module}/server-runtime.sh.tftpl", {
    aws_region                          = var.aws_region
    artifact_bucket                     = aws_s3_bucket.artifacts.id
    log_group_name                      = aws_cloudwatch_log_group.game_server.name
    server_log_retention_days           = var.server_log_retention_days
    server_bundle_object                = local.server_bundle_object
    world_seed                          = var.world_seed
    operational_event_table             = aws_dynamodb_table.operational_history.name
    operational_event_retention_seconds = local.operational_event_retention_seconds
  })
}

resource "aws_s3_bucket" "frontend" {
  bucket = var.domain_name
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "artifacts" {
  bucket = local.artifact_bucket_name
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_object" "server_bundle" {
  bucket = aws_s3_bucket.artifacts.id
  key    = local.server_bundle_object
  source = local.server_bundle_source
  etag   = filemd5(local.server_bundle_source)

  lifecycle {
    ignore_changes = [source, etag]
  }
}

resource "aws_acm_certificate" "frontend" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_iam_role" "game_server" {
  name = "${local.name}-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.game_server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.game_server.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy" "server_artifacts" {
  name = "server-artifacts"
  role = aws_iam_role.game_server.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ]
      Effect   = "Allow"
      Resource = "${aws_s3_bucket.artifacts.arn}/*"
    }]
  })
}

resource "aws_dynamodb_table" "operational_history" {
  name         = "${local.name}-operational-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "actor_key"
  range_key    = "event_key"

  attribute {
    name = "actor_key"
    type = "S"
  }

  attribute {
    name = "event_key"
    type = "S"
  }

  attribute {
    name = "time_partition"
    type = "S"
  }

  attribute {
    name = "time_key"
    type = "S"
  }

  global_secondary_index {
    name = "by_time"

    key_schema {
      attribute_name = "time_partition"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "time_key"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "${local.name}-operational-history"
    project     = "dungeoncrawler2d"
    environment = "prod"
  }
}

resource "aws_iam_role_policy" "operational_history" {
  name = "operational-history-write"
  role = aws_iam_role.game_server.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = aws_dynamodb_table.operational_history.arn
    }]
  })
}

resource "aws_iam_instance_profile" "game_server" {
  name = "${local.name}-instance"
  role = aws_iam_role.game_server.name
}

resource "aws_security_group" "game_server" {
  name        = "${local.name}-websocket"
  description = "CloudFront-only access to the authoritative WebSocket server"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "cloudfront_websocket" {
  security_group_id = aws_security_group.game_server.id
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id
  from_port         = 8081
  to_port           = 8081
  ip_protocol       = "tcp"
  description       = "WebSocket traffic from CloudFront origins"
}

resource "aws_vpc_security_group_egress_rule" "game_server_ipv4" {
  security_group_id = aws_security_group.game_server.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "Package installation, S3 artifacts, and SSM"
}

resource "aws_instance" "game_server" {
  ami                         = data.aws_ssm_parameter.amazon_linux_2023_arm64.value
  instance_type               = var.instance_type
  subnet_id                   = sort(data.aws_subnets.default.ids)[0]
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.game_server.id]
  iam_instance_profile        = aws_iam_instance_profile.game_server.name

  user_data = local.game_server_runtime_configuration

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = local.name
  }

  lifecycle {
    prevent_destroy = true

    # Production state lives on this instance's root volume. AMI releases and
    # runtime-script edits must be deliberate migrations, never routine applies.
    ignore_changes = [ami, user_data]
  }

  depends_on = [
    aws_iam_role_policy.server_artifacts,
    aws_iam_role_policy.operational_history,
    aws_iam_role_policy_attachment.cloudwatch_agent,
    aws_iam_role_policy_attachment.ssm,
    aws_s3_object.server_bundle,
  ]
}

resource "aws_ssm_association" "game_server_runtime" {
  name             = "AWS-RunShellScript"
  association_name = "${local.name}-runtime"

  parameters = {
    commands = local.game_server_runtime_configuration
  }

  targets {
    key    = "InstanceIds"
    values = [aws_instance.game_server.id]
  }

  wait_for_success_timeout_seconds = 600

  depends_on = [
    aws_cloudwatch_log_group.game_server,
    aws_dynamodb_table.operational_history,
    aws_iam_role_policy.operational_history,
    aws_iam_role_policy.server_artifacts,
    aws_iam_role_policy_attachment.cloudwatch_agent,
    aws_iam_role_policy_attachment.ssm,
    aws_s3_object.server_bundle,
  ]
}

resource "aws_cloudwatch_log_group" "game_server" {
  name              = "/dungeoncrawler2d/prod/server"
  retention_in_days = var.server_log_retention_days
}

resource "aws_cloudwatch_log_metric_filter" "server_errors" {
  name           = "${local.name}-server-errors"
  log_group_name = aws_cloudwatch_log_group.game_server.name
  pattern        = "{ $.level = \"error\" && $.eventType = \"server_error\" }"

  metric_transformation {
    name      = "ServerErrors"
    namespace = "DungeonCrawler2D/Server"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "server_errors" {
  alarm_name          = "${local.name}-server-errors"
  alarm_description   = "The authoritative server logged a fatal or unhandled error."
  namespace           = "DungeonCrawler2D/Server"
  metric_name         = "ServerErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "server_cpu" {
  alarm_name          = "${local.name}-high-cpu"
  alarm_description   = "Authoritative server CPU exceeded 85% for ten minutes."
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 85
  dimensions = {
    InstanceId = aws_instance.game_server.id
  }
}

resource "aws_cloudwatch_metric_alarm" "server_status" {
  alarm_name          = "${local.name}-status-check"
  alarm_description   = "The production game server failed an EC2 status check."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  dimensions = {
    InstanceId = aws_instance.game_server.id
  }
}

resource "aws_cloudwatch_dashboard" "production" {
  dashboard_name = local.name
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          title  = "Authoritative server"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.game_server.id],
            [".", "NetworkIn", ".", "."],
            [".", "NetworkOut", ".", "."],
            ["DungeonCrawler2D/Server", "ServerErrors"]
          ]
        }
      },
      {
        type   = "log"
        width  = 12
        height = 6
        properties = {
          title  = "Recent server errors"
          region = var.aws_region
          query  = "SOURCE '${aws_cloudwatch_log_group.game_server.name}' | fields @timestamp, source, errorName, message | filter level = \"error\" and eventType = \"server_error\" | sort @timestamp desc | limit 50"
        }
      }
    ]
  })
}

data "aws_iam_policy_document" "backup_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${local.name}-backup"
  assume_role_policy = data.aws_iam_policy_document.backup_assume_role.json
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_vault" "player_data" {
  name = "${local.name}-player-data"
}

resource "aws_backup_plan" "player_data" {
  name = "${local.name}-daily"

  rule {
    rule_name         = "daily-player-data"
    target_vault_name = aws_backup_vault.player_data.name
    schedule          = "cron(0 8 * * ? *)"
    start_window      = 60
    completion_window = 180

    lifecycle {
      delete_after = 35
    }

    recovery_point_tags = {
      project     = "dungeoncrawler2d"
      environment = "prod"
      data        = "player-state"
    }
  }
}

resource "aws_backup_selection" "player_data" {
  name         = "${local.name}-instance"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.player_data.id
  resources    = [aws_instance.game_server.arn]
}

resource "aws_eip" "game_server" {
  domain   = "vpc"
  instance = aws_instance.game_server.id

  tags = {
    Name = local.name
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name}-frontend"
  description                       = "Private S3 access for the Dungeon Crawler 2D client"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate_validation" "frontend" {
  count = var.enable_distribution ? 1 : 0

  certificate_arn = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [
    for option in aws_acm_certificate.frontend.domain_validation_options : option.resource_record_name
  ]
}

resource "aws_cloudfront_distribution" "frontend" {
  count = var.enable_distribution ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Dungeon Crawler 2D client and WebSocket edge"
  aliases             = [var.domain_name]
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = local.frontend_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    domain_name = aws_eip.game_server.public_dns
    origin_id   = local.game_server_origin_id

    custom_origin_config {
      http_port              = 8081
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.frontend_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern             = "/ws*"
    target_origin_id         = local.game_server_origin_id
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    compress                 = false
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.frontend[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "frontend" {
  count = var.enable_distribution ? 1 : 0

  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend[0].arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  count = var.enable_distribution ? 1 : 0

  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend[0].json
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"
      identifiers = [
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:sladewasinger/DungeonCrawler2D:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${local.name}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid       = "ReadReleaseArtifacts"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.artifacts.arn]
  }

  statement {
    sid     = "PublishReleaseArtifacts"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      "${aws_s3_bucket.artifacts.arn}/server/*",
      "${aws_s3_bucket.artifacts.arn}/client/*",
      "${aws_s3_bucket.artifacts.arn}/releases/*"
    ]
  }

  statement {
    sid       = "PublishFrontend"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.frontend.arn]
  }

  statement {
    sid       = "PublishFrontendObjects"
    actions   = ["s3:DeleteObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
  }

  statement {
    sid       = "UseRestartDocument"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"]
  }

  statement {
    sid       = "RestartTaggedGameServer"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*"]

    condition {
      test     = "StringEquals"
      variable = "ssm:resourceTag/project"
      values   = ["dungeoncrawler2d"]
    }

    condition {
      test     = "StringEquals"
      variable = "ssm:resourceTag/environment"
      values   = ["prod"]
    }
  }

  statement {
    sid       = "ObserveDeployment"
    actions   = ["ec2:DescribeInstances", "ssm:GetCommandInvocation"]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = var.enable_distribution ? [1] : []
    content {
      sid     = "InvalidateFrontend"
      actions = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
      resources = [
        "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${local.production_distribution_id}"
      ]
    }
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "production-deploy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}

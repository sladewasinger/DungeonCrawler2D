terraform {
  backend "s3" {
    bucket       = "austinwasingerdotcom-terraform-state-510682130762"
    key          = "dungeoncrawler2d/prod/terraform.tfstate"
    region       = "us-west-2"
    profile      = "terraform"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "contractflow"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

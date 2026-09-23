module "network" {
  source = "./modules/network"

  name     = "${var.project_name}-${var.environment}-vpc"
  vpc_cidr = "10.10.0.0/16"

  public_subnets = {
    a = {
      cidr_block        = "10.10.1.0/24"
      availability_zone = "eu-north-1a"
    }

    b = {
      cidr_block        = "10.10.2.0/24"
      availability_zone = "eu-north-1b"
    }
  }

  application_subnets = {
    a = {
      cidr_block        = "10.10.11.0/24"
      availability_zone = "eu-north-1a"
    }

    b = {
      cidr_block        = "10.10.12.0/24"
      availability_zone = "eu-north-1b"
    }
  }

  database_subnets = {
    a = {
      cidr_block        = "10.10.21.0/24"
      availability_zone = "eu-north-1a"
    }

    b = {
      cidr_block        = "10.10.22.0/24"
      availability_zone = "eu-north-1b"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "database" {
  source = "./modules/database"

  name = "${var.project_name}-${var.environment}"

  vpc_id = module.network.vpc_id

  database_subnet_ids = values(
    module.network.database_subnet_ids
  )

  db_name     = "contractflow"
  db_username = "contractflow_admin"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

output "vpc_id" {
  description = "ID of the ContractFlow VPC"
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Map of ContractFlow public subnet IDs"
  value       = module.network.public_subnet_ids
}

output "application_subnet_ids" {
  description = "Map of ContractFlow private application subnet IDs"
  value       = module.network.application_subnet_ids
}

output "database_subnet_ids" {
  description = "Map of ContractFlow private database subnet IDs"
  value       = module.network.database_subnet_ids
}

output "database_endpoint" {
  description = "Endpoint of the ContractFlow PostgreSQL database"
  value       = module.database.endpoint
}

output "database_port" {
  description = "Port of the ContractFlow PostgreSQL database"
  value       = module.database.port
}

output "database_name" {
  description = "Name of the ContractFlow PostgreSQL database"
  value       = module.database.database_name
}

output "database_security_group_id" {
  description = "Security group ID of the ContractFlow PostgreSQL database"
  value       = module.database.security_group_id
}

output "database_master_user_secret_arn" {
  description = "ARN of the AWS-managed RDS master credential secret"
  value       = module.database.master_user_secret_arn
  sensitive   = true
}

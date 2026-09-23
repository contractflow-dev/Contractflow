output "endpoint" {
  description = "Endpoint of the ContractFlow PostgreSQL database"
  value       = aws_db_instance.postgresql.address
}

output "port" {
  description = "Port used by the ContractFlow PostgreSQL database"
  value       = aws_db_instance.postgresql.port
}

output "database_name" {
  description = "Name of the ContractFlow PostgreSQL database"
  value       = aws_db_instance.postgresql.db_name
}

output "security_group_id" {
  description = "Security group attached to the PostgreSQL database"
  value       = aws_security_group.database.id
}

output "master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the RDS master credentials"
  value       = aws_db_instance.postgresql.master_user_secret[0].secret_arn
  sensitive   = true
}
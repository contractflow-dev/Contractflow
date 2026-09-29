output "security_group_id" {
  description = "ID of the ContractFlow application security group"
  value       = aws_security_group.application.id
}

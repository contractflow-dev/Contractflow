output "vpc_id" {
  description = "ID of the ContractFlow VPC"
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "Map of public subnet IDs"

  value = {
    for name, subnet in aws_subnet.public :
    name => subnet.id
  }
}

output "application_subnet_ids" {
  description = "Map of private application subnet IDs"

  value = {
    for name, subnet in aws_subnet.application :
    name => subnet.id
  }
}

output "database_subnet_ids" {
  description = "Map of private database subnet IDs"

  value = {
    for name, subnet in aws_subnet.database :
    name => subnet.id
  }
}

variable "name" {
  description = "Name used for ContractFlow database resources"
  type        = string
}

variable "database_subnet_ids" {
  description = "Private subnet IDs where the RDS PostgreSQL database can run"
  type        = list(string)
}

variable "vpc_id" {
  description = "ID of the VPC containing the database"
  type        = string
}

variable "application_security_group_id" {
  description = "Application security group allowed to connect to PostgreSQL"
  type        = string
}

variable "db_name" {
  description = "Initial PostgreSQL database name"
  type        = string
  default     = "contractflow"
}

variable "db_username" {
  description = "Master username for PostgreSQL"
  type        = string
  default     = "contractflow_admin"
}

variable "tags" {
  description = "Tags applied to database resources"
  type        = map(string)
  default     = {}
}

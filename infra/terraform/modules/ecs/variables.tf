variable "name" {
  description = "Name prefix for ContractFlow ECS resources"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "web_repository_url" {
  description = "ECR repository URL for the ContractFlow web application"
  type        = string
}

variable "api_repository_url" {
  description = "ECR repository URL for the ContractFlow API"
  type        = string
}

variable "web_container_port" {
  description = "Container port used by the ContractFlow web application"
  type        = number
  default     = 3000
}

variable "api_container_port" {
  description = "Container port used by the ContractFlow API"
  type        = number
  default     = 3001
}

variable "tags" {
  description = "Tags applied to ECS resources"
  type        = map(string)
  default     = {}
}

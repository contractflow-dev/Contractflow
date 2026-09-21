variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "contractflow"
}

variable "environment" {
  description = "The deployment environment"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for ContractFlow resources"
  type        = string
  default     = "eu-north-1"
}

variable "project_name" {
  description = "Name of the ContractFlow project"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "repository_names" {
  description = "List of ECR repository names"
  type        = set(string)
}

variable "tags" {
  description = "Tags to apply to ECR repositories"
  type        = map(string)
  default     = {}
}

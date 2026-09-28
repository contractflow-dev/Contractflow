variable "name" {
  description = "Name used for ContractFlow application resources"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC containing the ContractFlow application"
  type        = string
}

variable "tags" {
  description = "Tags applied to application resources"
  type        = map(string)
  default     = {}
}

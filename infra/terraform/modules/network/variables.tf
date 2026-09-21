variable "name" {
  description = "Name of the ContractFlow VPC"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "public_subnets" {
  description = "Public subnets across Availability Zones"

  type = map(object({
    cidr_block        = string
    availability_zone = string
  }))
}

variable "application_subnets" {
  description = "Private application subnets across Availability Zones"

  type = map(object({
    cidr_block        = string
    availability_zone = string
  }))
}

variable "database_subnets" {
  description = "Private database subnets across Availability Zones"

  type = map(object({
    cidr_block        = string
    availability_zone = string
  }))
}

variable "tags" {
  description = "Tags applied to network resources"
  type        = map(string)
  default     = {}
}

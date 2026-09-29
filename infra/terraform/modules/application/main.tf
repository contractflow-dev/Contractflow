resource "aws_security_group" "application" {
  name        = "${var.name}-app-sg"
  description = "Security group for ContractFlow application resources"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.name}-app-sg"
  })
}

resource "aws_ecr_repository" "repositories" {
  for_each = var.repository_names

  name                 = "${var.project_name}-${var.environment}-${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-${each.value}"
  })
}

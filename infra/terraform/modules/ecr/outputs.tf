output "repository_urls" {
  description = "URLs of the created ECR repositories"

  value = {
    for name, repository in aws_ecr_repository.repositories :
    name => repository.repository_url
  }
}

output "repository_arns" {
  description = "ARNs of the created ECR repositories"

  value = {
    for name, repository in aws_ecr_repository.repositories :
    name => repository.arn
  }
}

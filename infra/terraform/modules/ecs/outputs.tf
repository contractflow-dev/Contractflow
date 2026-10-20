output "cluster_id" {
  description = "ID of the ContractFlow ECS cluster"
  value       = aws_ecs_cluster.this.id
}

output "cluster_arn" {
  description = "ARN of the ContractFlow ECS cluster"
  value       = aws_ecs_cluster.this.arn
}

output "web_task_definition_arn" {
  description = "ARN of the ContractFlow web ECS task definition"
  value       = aws_ecs_task_definition.web.arn
}

output "api_task_definition_arn" {
  description = "ARN of the ContractFlow API ECS task definition"
  value       = aws_ecs_task_definition.api.arn
}

output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "task_role_arn" {
  description = "ARN of the ECS application task role"
  value       = aws_iam_role.ecs_task.arn
}

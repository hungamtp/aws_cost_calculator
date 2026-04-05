# Advanced Microservices Architecture
provider "aws" {
  region = "us-east-1"
}

resource "aws_eks_cluster" "main" {
  name     = "microservices-eks-cluster"
  role_arn = aws_iam_role.eks_role.arn
}

resource "aws_eks_node_group" "workers" {
  cluster_name    = aws_eks_cluster.main.name
  instance_types  = ["m5.large"]
  scaling_config {
    desired_size = 3
  }
}

resource "aws_api_gateway_rest_api" "api" {
  name = "microservices-gateway"
}

resource "aws_lambda_function" "auth_service" {
  function_name = "AuthLambda"
  runtime       = "nodejs18.x"
  memory_size   = 1024
}

resource "aws_dynamodb_table" "users_table" {
  name           = "Users"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "UserId"
}

resource "aws_cloudformation_stack" "sqs_event_bus" {
  name = "event-queue"
}

resource "aws_rds_cluster" "aurora_db" {
  cluster_identifier      = "aurora-cluster"
  engine                  = "aurora-postgresql"
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "cluster-redis"
  engine               = "redis"
  node_type            = "cache.t3.medium"
  num_cache_nodes      = 2
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled = true
}

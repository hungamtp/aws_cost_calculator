module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "banking-core-cluster"
  cluster_version = "1.31"
  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnets

  eks_managed_node_groups = {
    transaction_nodes = {
      instance_types = ["m5.large"]
      min_size     = 3
      max_size     = 10
      desired_size = 3
      taints = [{
        key    = "workload"
        value  = "transactions"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}